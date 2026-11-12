import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  discoveryResults,
  discoveryRuns,
  evidenceItems,
  importBatches,
  persons,
  profileAnalyses,
  profileEmbeddings,
  profileSources,
  referenceProfiles,
} from "@/db/schema";
import { ANALYZER_VERSION, analyseReference, type ReferenceInput } from "./analysis";
import { getActiveConfig } from "./config";
import { diversify, scoreCandidates, sortScored, type CandidateData, type PersonRow, type PoolInfo } from "./ranking";
import { ACTIVE_DATASET_VERSION, ensureSeeded } from "./seed";
import { buildTsQuery, cosine, embed, normaliseKey, EMBEDDING_MODEL } from "./text";
import type {
  CandidateEvidence,
  CandidateSource,
  ClaimType,
  RankingConfig,
  ReferenceAnalysis,
  ScoredCandidate,
  SourceType,
} from "./types";

export interface Corpus {
  batchId: string;
  datasetVersion: string;
  asOf: Date;
  dataOrigin: string;
  candidates: Map<string, CandidateData>;
}

export async function loadCorpus(): Promise<Corpus> {
  await ensureSeeded();
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.datasetVersion, ACTIVE_DATASET_VERSION)).limit(1);
  const [people, evidence, sources, embs] = await Promise.all([
    db.select().from(persons).where(eq(persons.batchId, batch.id)).orderBy(asc(persons.id)),
    db.select().from(evidenceItems).orderBy(asc(evidenceItems.id)),
    db.select().from(profileSources).orderBy(asc(profileSources.id)),
    db.select().from(profileEmbeddings).where(eq(profileEmbeddings.modelName, EMBEDDING_MODEL)),
  ]);
  const candidates = new Map<string, CandidateData>();
  for (const p of people) {
    const e = embs.find((x) => x.personId === p.id);
    candidates.set(p.id, {
      person: p,
      evidence: evidence.filter((x) => x.personId === p.id).map(toEvidence),
      sources: sources.filter((x) => x.personId === p.id).map(toSource),
      embedding: e?.embedding ?? [],
      roleEmbedding: e?.roleEmbedding ?? [],
    });
  }
  return { batchId: batch.id, datasetVersion: batch.datasetVersion, asOf: batch.asOf, dataOrigin: batch.dataOrigin, candidates };
}

export function toEvidence(x: typeof evidenceItems.$inferSelect): CandidateEvidence {
  return {
    id: x.id, sourceId: x.sourceId, claimType: x.claimType as ClaimType, claimText: x.claimText,
    excerpt: x.excerpt, sourceLocator: x.sourceLocator, confidence: x.confidence, reviewStatus: x.reviewStatus,
  };
}

export function toSource(x: typeof profileSources.$inferSelect): CandidateSource {
  return {
    id: x.id, sourceName: x.sourceName, sourceType: x.sourceType as SourceType, sourceUrl: x.sourceUrl,
    publisherOrOwner: x.publisherOrOwner, accessMethod: x.accessMethod, permissionNotes: x.permissionNotes,
    dataOrigin: x.dataOrigin, retrievedAt: x.retrievedAt.toISOString(), verificationStatus: x.verificationStatus, notes: x.notes,
  };
}

/** Lexical channel: Postgres full-text search with synonym-expanded query. */
export async function lexicalSearch(batchId: string, phrases: string[], topK: number): Promise<{ id: string; score: number }[]> {
  const q = buildTsQuery(phrases);
  if (!q) return [];
  const res = await db.execute(sql`
    select id, ts_rank_cd(to_tsvector('english', search_doc), to_tsquery('english', ${q})) as r
    from persons
    where batch_id = ${batchId} and to_tsvector('english', search_doc) @@ to_tsquery('english', ${q})
    order by r desc, id asc
    limit ${topK}`);
  return (res.rows as { id: string; r: number }[]).map((r) => ({ id: r.id, score: Number(r.r) }));
}

export function vectorSearch(corpus: Corpus, refEmbedding: number[], topK: number): { id: string; score: number }[] {
  return [...corpus.candidates.values()]
    .filter((c) => c.embedding.length)
    .map((c) => ({ id: c.person.id, score: cosine(refEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, topK);
}

export function rrfMerge(lex: { id: string }[], vec: { id: string }[], k: number): Map<string, PoolInfo> {
  const out = new Map<string, PoolInfo>();
  const touch = (id: string) => out.get(id) ?? { lexicalRank: null, vectorRank: null, rrf: 0 };
  lex.forEach((x, i) => {
    const cur = touch(x.id);
    cur.lexicalRank = i + 1;
    cur.rrf += 1 / (k + i + 1);
    out.set(x.id, cur);
  });
  vec.forEach((x, i) => {
    const cur = touch(x.id);
    cur.vectorRank = i + 1;
    cur.rrf += 1 / (k + i + 1);
    out.set(x.id, cur);
  });
  return out;
}

export interface DiscoverOptions {
  analysis: ReferenceAnalysis;
  config: RankingConfig;
  country?: string | null;
  excludePersonIds?: string[];
  fullPool?: boolean;
}

export interface DiscoverOutput {
  corpus: Corpus;
  scored: ScoredCandidate[];
  lexical: { id: string; score: number }[];
  vector: { id: string; score: number }[];
  stats: Record<string, unknown>;
}

export async function discover(opts: DiscoverOptions): Promise<DiscoverOutput> {
  const { analysis, config } = opts;
  const t0 = Date.now();
  const corpus = await loadCorpus();
  const tLoad = Date.now();
  const lexK = opts.fullPool ? 1000 : config.retrieval.lexical_top_k;
  const vecK = opts.fullPool ? 1000 : config.retrieval.vector_top_k;
  const refEmb = embed(analysis.reference_document);
  const refRole = embed(analysis.role_document);
  const lexical = await lexicalSearch(corpus.batchId, analysis.query_terms, lexK);
  const vector = vectorSearch(corpus, refEmb, vecK);
  const info = rrfMerge(lexical, vector, config.retrieval.rrf_k);
  const tRetrieve = Date.now();

  const removed = { self_match: 0, no_source: 0, no_evidence: 0, outside_geography: 0 };
  const eligible: CandidateData[] = [];
  const poolAll = [...info.keys()].map((id) => corpus.candidates.get(id)).filter((x): x is CandidateData => !!x);
  const refName = normaliseKey(analysis.display_name);
  const refOrg = normaliseKey(analysis.current_organisation);
  const exclude = new Set(opts.excludePersonIds ?? []);
  for (const c of poolAll) {
    const sameName = normaliseKey(c.person.displayName) === refName;
    const orgKey = normaliseKey(c.person.currentOrganisation);
    if (exclude.has(c.person.id) || (sameName && (!refOrg || !orgKey || orgKey === refOrg))) { removed.self_match++; continue; }
    if (!c.sources.length) { removed.no_source++; continue; }
    if (!c.evidence.length) { removed.no_evidence++; continue; }
    if (opts.country && c.person.country && c.person.country !== opts.country) { removed.outside_geography++; continue; }
    eligible.push(c);
  }

  // Calibration uses the whole retrieval pool so the scale doesn't shift with filters.
  const scoredAll = scoreCandidates({ analysis, refEmbedding: refEmb, refRoleEmbedding: refRole, pool: poolAll, info, config, asOf: corpus.asOf });
  const eligibleIds = new Set(eligible.map((c) => c.person.id));
  let scored = sortScored(scoredAll.filter((s) => eligibleIds.has(s.personId)));
  if (config.diversity.enabled) {
    const pm = new Map<string, PersonRow>([...corpus.candidates].map(([id, c]) => [id, c.person]));
    scored = diversify(scored, pm, config.diversity.lambda);
  }
  const tRank = Date.now();

  return {
    corpus, scored, lexical, vector,
    stats: {
      dataset_version: corpus.datasetVersion,
      ranker_version: config.version,
      lexical_hits: lexical.length,
      vector_hits: vector.length,
      merged_pool: poolAll.length,
      removed,
      eligible: eligible.length,
      latency_ms: { load: tLoad - t0, retrieve: tRetrieve - tLoad, rank: tRank - tRetrieve, total: tRank - t0 },
    },
  };
}

// ───────────────────────── Runs

export interface CreateRunInput {
  referenceProfileId?: string;
  profileText?: string;
  displayName?: string;
  currentRole?: string | null;
  organisation?: string | null;
  location?: string | null;
  limit: number;
  minimumScore: number | null;
  country: string | null;
}

export async function resolveReference(input: CreateRunInput): Promise<{ kind: "seeded" | "pasted"; id: string | null; label: string; refInput: ReferenceInput }> {
  await ensureSeeded();
  if (input.referenceProfileId) {
    const [r] = await db.select().from(referenceProfiles).where(eq(referenceProfiles.id, input.referenceProfileId)).limit(1);
    if (!r) throw new HttpError(404, "reference_not_found", "No seeded reference profile with that id.");
    return { kind: "seeded", id: r.id, label: r.displayName, refInput: { displayName: r.displayName, profileText: r.profileText, currentRole: r.currentRole, organisation: r.organisation, location: r.location } };
  }
  return {
    kind: "pasted", id: null, label: input.displayName ?? "Pasted profile",
    refInput: { displayName: input.displayName ?? "Pasted profile", profileText: input.profileText ?? "", currentRole: input.currentRole, organisation: input.organisation, location: input.location },
  };
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function createRun(input: CreateRunInput): Promise<string> {
  const started = Date.now();
  const ref = await resolveReference(input);
  const config = await getActiveConfig();
  const analysis = analyseReference(ref.refInput);
  const minScore = input.minimumScore ?? config.results.default_minimum_score;
  const out = await discover({ analysis, config, country: input.country });
  const runId = `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const relevant = out.scored.filter((s) => s.score >= minScore).length;

  await db.transaction(async (tx) => {
    await tx.insert(discoveryRuns).values({
      id: runId, status: "completed", referenceKind: ref.kind, referenceId: ref.id, referenceLabel: ref.label,
      analysis: analysis as unknown as Record<string, unknown>,
      params: { limit: input.limit, minimum_score: minScore, country: input.country },
      datasetVersion: out.corpus.datasetVersion, rankerVersion: config.version,
      configSnapshot: config as unknown as Record<string, unknown>,
      retrievalStats: out.stats, candidateCount: out.scored.length, relevantCount: relevant,
      latencyMs: Date.now() - started,
    });
    await tx.insert(profileAnalyses).values({
      id: `ana_${runId}`, subjectType: "run", subjectId: runId,
      analysisJson: analysis as unknown as Record<string, unknown>, analyzerVersion: ANALYZER_VERSION, modelName: "rules (no LLM)",
    });
    if (out.scored.length) {
      await tx.insert(discoveryResults).values(
        out.scored.map((s, i) => ({
          id: `${runId}_${i + 1}`, runId, personId: s.personId, rank: i + 1, score: s.score,
          components: s.components, explanation: s.explanation, factors: s.factors, limitations: s.limitations,
          evidenceIds: s.evidenceIds, retrieval: s.retrieval, completeness: s.completeness,
          confidenceLabel: s.confidenceLabel, warnings: s.warnings,
        })),
      );
    }
  });
  return runId;
}

export async function getRun(runId: string) {
  const [run] = await db.select().from(discoveryRuns).where(eq(discoveryRuns.id, runId)).limit(1);
  return run ?? null;
}

export interface ResultFilters {
  region?: string;
  category?: string;
  minScore?: number;
  status?: string;
  multi?: boolean;
  sourceType?: string;
  sort?: string;
}

export interface ResultRow {
  rank: number;
  score: number;
  components: import("./types").ScoreComponent[];
  explanation: string;
  factors: import("./types").ExplanationFactor[];
  limitations: string[];
  warnings: string[];
  completeness: number;
  confidenceLabel: string;
  retrieval: { lexicalRank: number | null; vectorRank: number | null; rrf: number; cosine: number };
  person: PersonRow;
  evidence: CandidateEvidence[];
  sources: CandidateSource[];
}

const comp = (r: ResultRow, key: string) => r.components.find((c) => c.key === key)?.value ?? -1;

export async function getRunResults(runId: string, f: ResultFilters): Promise<ResultRow[]> {
  const rows = await db.select().from(discoveryResults).where(eq(discoveryResults.runId, runId)).orderBy(asc(discoveryResults.rank));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.personId);
  const [people, ev, src] = await Promise.all([
    db.select().from(persons).where(inArray(persons.id, ids)),
    db.select().from(evidenceItems).where(inArray(evidenceItems.personId, ids)).orderBy(asc(evidenceItems.id)),
    db.select().from(profileSources).where(inArray(profileSources.personId, ids)).orderBy(asc(profileSources.id)),
  ]);
  const pmap = new Map(people.map((p) => [p.id, p]));
  let out: ResultRow[] = rows.map((r) => ({
    rank: r.rank, score: r.score, components: r.components as ResultRow["components"], explanation: r.explanation,
    factors: r.factors as ResultRow["factors"], limitations: r.limitations, warnings: r.warnings,
    completeness: r.completeness, confidenceLabel: r.confidenceLabel, retrieval: r.retrieval as ResultRow["retrieval"],
    person: pmap.get(r.personId)!,
    evidence: ev.filter((e) => e.personId === r.personId).map(toEvidence),
    sources: src.filter((s) => s.personId === r.personId).map(toSource),
  }));
  if (f.region) out = out.filter((r) => r.person.region === f.region);
  if (f.category) out = out.filter((r) => r.person.roleFamilies.includes(f.category!));
  if (f.minScore !== undefined) out = out.filter((r) => r.score >= f.minScore!);
  if (f.status) out = out.filter((r) => r.person.roleStatus === f.status);
  if (f.multi) out = out.filter((r) => comp(r, "multi_school_exposure") >= 0.7);
  if (f.sourceType) out = out.filter((r) => r.sources.some((s) => s.sourceType === f.sourceType));
  const sortKey: Record<string, string> = { school: "school_ecosystem_relevance", leadership: "leadership_governance", multi: "multi_school_exposure", confidence: "data_confidence" };
  if (f.sort && sortKey[f.sort]) {
    const k = sortKey[f.sort];
    out = [...out].sort((a, b) => comp(b, k) - comp(a, k) || a.rank - b.rank);
  }
  return out;
}

export async function listRecentRuns(limit = 6) {
  return db.select().from(discoveryRuns).orderBy(desc(discoveryRuns.createdAt)).limit(limit);
}

export async function getCandidate(personId: string) {
  await ensureSeeded();
  const [p] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
  if (!p) return null;
  const [ev, src] = await Promise.all([
    db.select().from(evidenceItems).where(eq(evidenceItems.personId, personId)).orderBy(asc(evidenceItems.id)),
    db.select().from(profileSources).where(eq(profileSources.personId, personId)).orderBy(asc(profileSources.id)),
  ]);
  return { person: p, evidence: ev.map(toEvidence), sources: src.map(toSource) };
}

export async function getCandidateRunContext(personId: string, runId: string) {
  const [r] = await db.select().from(discoveryResults).where(and(eq(discoveryResults.runId, runId), eq(discoveryResults.personId, personId))).limit(1);
  return r ?? null;
}
