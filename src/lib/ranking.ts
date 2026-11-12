import { persons } from "@/db/schema";
import { CLAIM_TYPES, FEATURES, familySimilarity } from "./taxonomy";
import { buildExplanation } from "./explain";
import { cosine, percentileCalibrate } from "./text";
import type {
  CandidateEvidence,
  CandidateSource,
  FeatureKey,
  RankingConfig,
  ReferenceAnalysis,
  RoleFamily,
  ScoreComponent,
  ScoredCandidate,
} from "./types";

export const RANKER_NAME = "hybrid-weighted-ranker";

export type PersonRow = typeof persons.$inferSelect;

export interface CandidateData {
  person: PersonRow;
  evidence: CandidateEvidence[];
  sources: CandidateSource[];
  embedding: number[];
  roleEmbedding: number[];
}

export interface PoolInfo {
  lexicalRank: number | null;
  vectorRank: number | null;
  rrf: number;
}

const ROLE_SCORES: Record<string, number> = {
  principal: 1,
  "head of school": 1,
  trustee: 1,
  "school owner": 1,
  owner: 1,
  chair: 1,
  "network leader": 0.85,
  founder: 0.7,
  advisor: 0.5,
  "policy advisor": 0.5,
};

const TITLE_KEYWORDS: { re: RegExp; score: number }[] = [
  { re: /\b(owner|proprietor|promoter|trustee|chairperson|chairman|chair|founder|ceo|chief executive|managing director|president)\b/i, score: 1 },
  { re: /\b(principal|head of school|headmaster|headmistress|academic director)\b/i, score: 1 },
  { re: /\b(regional director|vice president|director)\b/i, score: 0.75 },
  { re: /\b(head|lead|advisor|adviser|consultant|coach|trainer)\b/i, score: 0.5 },
  { re: /\b(manager|coordinator|programme|officer|associate|teacher|correspondent|professor)\b/i, score: 0.25 },
];

const MONTH = 30.44 * 86400000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function dataCompleteness(c: CandidateData): number {
  const p = c.person;
  const checks = [
    !!p.currentTitle,
    !!p.currentOrganisation,
    !!p.location,
    !!p.biography,
    p.careerHistory.length > 0,
    p.sectorTags.length > 0,
    p.schoolRoles.length > 0,
    p.schoolExposure !== "unknown",
    !!p.lastVerifiedAt,
    c.sources.length >= 1,
    c.evidence.length >= 2,
  ];
  return r2(checks.filter(Boolean).length / checks.length);
}

function schoolRelevance(c: CandidateData): { value: number; note: string } {
  let best = 0;
  let label = "no supported school-sector evidence";
  for (const e of c.evidence) {
    const s = CLAIM_TYPES[e.claimType]?.s ?? 0;
    if (s > best) {
      best = s;
      label = CLAIM_TYPES[e.claimType].label.toLowerCase();
    }
  }
  return { value: best, note: best > 0 ? `Strongest evidence: ${label}` : "No supported school-sector evidence" };
}

function roleSimilarity(analysis: ReferenceAnalysis, c: CandidateData, responsibilityCal: number): { value: number; note: string } {
  const ref = analysis.role_families.filter((f) => f !== "unknown");
  const cand = c.person.roleFamilies as RoleFamily[];
  let overlap = 0;
  if (ref.length && cand.length) {
    overlap = ref.reduce((acc, rf) => acc + Math.max(...cand.map((cf) => familySimilarity(rf, cf))), 0) / ref.length;
  }
  return {
    value: 0.6 * overlap + 0.4 * responsibilityCal,
    note: `Role-family overlap ${Math.round(overlap * 100)}% · responsibility similarity ${Math.round(responsibilityCal * 100)}%`,
  };
}

function multiSchool(c: CandidateData): { value: number | null; note: string } {
  const claimValues = c.evidence.map((e) => CLAIM_TYPES[e.claimType]?.multi ?? 0);
  const best = Math.max(0, ...claimValues);
  if (best === 0 && c.person.schoolExposure === "unknown") return { value: null, note: "Exposure not documented — excluded and weights renormalised" };
  if (best === 0) return { value: 0, note: "No documented work across multiple schools" };
  return { value: best, note: best >= 1 ? "Explicit work across multiple schools or a group" : best >= 0.7 ? "Portfolio / network role across schools" : "One school plus some cross-school activity" };
}

function leadership(c: CandidateData, sValue: number, gateMin: number): { value: number | null; note: string } {
  const p = c.person;
  if (!p.currentTitle && !p.schoolRoles.length && !c.evidence.length) return { value: null, note: "No role information" };
  let title = 0;
  for (const k of TITLE_KEYWORDS) if (p.currentTitle && k.re.test(p.currentTitle)) title = Math.max(title, k.score);
  const roles = Math.max(0, ...p.schoolRoles.map((r) => ROLE_SCORES[r] ?? 0));
  let claim = 0;
  for (const e of c.evidence) {
    const def = CLAIM_TYPES[e.claimType];
    if (def?.leadership) claim = Math.max(claim, e.claimType === "regional_network_role" ? 0.75 : 1);
  }
  let value = Math.max(title, roles, claim);
  let note = claim >= 1 ? "Documented school leadership / ownership / governance" : "Title-based leadership signal";
  if (claim === 0 && value > 0.7) {
    value = 0.7;
    note = "Leads a school-facing organisation (not school governance) — capped at 0.70";
  }
  if (sValue < gateMin) {
    value *= 0.3;
    note = "Leadership discounted — no supported school-sector evidence";
  }
  return { value, note };
}

function network(c: CandidateData): { value: number; note: string } {
  const n = c.evidence.filter((e) => CLAIM_TYPES[e.claimType]?.network).length;
  const value = n === 0 ? 0 : Math.min(1, 0.5 + 0.25 * (n - 1));
  return { value, note: n === 0 ? "No documented cross-organisation role" : `${n} documented ecosystem / connector claim${n > 1 ? "s" : ""}` };
}

function dataConfidence(c: CandidateData, completeness: number, asOf: Date): { value: number; note: string } {
  const p = c.person;
  const authority = p.evidenceQuality === "high" ? 1 : p.evidenceQuality === "medium" ? 0.65 : 0.35;
  const months = p.lastVerifiedAt ? (asOf.getTime() - p.lastVerifiedAt.getTime()) / MONTH : 99;
  const fresh = months <= 6 ? 1 : months <= 12 ? 0.75 : months <= 24 ? 0.5 : 0.25;
  let dates = p.roleStatus === "unknown" ? 0.2 : p.careerHistory.length ? 1 : 0.5;
  if (c.sources.length > 0 && c.sources.every((s) => s.sourceType === "conference_speaker_bio")) dates *= 0.5;
  return {
    value: 0.4 * authority + 0.25 * fresh + 0.25 * completeness + 0.1 * dates,
    note: `Source quality ${p.evidenceQuality} · verified ${months < 99 ? Math.round(months) + " mo before dataset date" : "never"} · completeness ${Math.round(completeness * 100)}%`,
  };
}

export function bandFor(score: number, cfg: RankingConfig): "High match" | "Strong match" | "Moderate match" | "Weak match" {
  return score >= cfg.bands.high ? "High match" : score >= cfg.bands.strong ? "Strong match" : score >= cfg.bands.moderate ? "Moderate match" : "Weak match";
}

export function scoreCandidates(args: {
  analysis: ReferenceAnalysis;
  refEmbedding: number[];
  refRoleEmbedding: number[];
  pool: CandidateData[];
  info: Map<string, PoolInfo>;
  config: RankingConfig;
  asOf: Date;
}): ScoredCandidate[] {
  const { analysis, pool, info, config, asOf } = args;
  const cosFull = pool.map((c) => cosine(args.refEmbedding, c.embedding));
  const cosRole = pool.map((c) => cosine(args.refRoleEmbedding, c.roleEmbedding));
  const calFull = percentileCalibrate(cosFull);
  const calRole = percentileCalibrate(cosRole);

  return pool.map((c, i) => {
    const completeness = dataCompleteness(c);
    const S = schoolRelevance(c);
    const R = roleSimilarity(analysis, c, calRole[i]);
    const M = multiSchool(c);
    const L = leadership(c, S.value, config.gate.min_school_relevance);
    const N = network(c);
    const C = dataConfidence(c, completeness, asOf);
    const raw: Record<FeatureKey, { value: number | null; note: string }> = {
      school_ecosystem_relevance: S,
      role_experience_similarity: R,
      multi_school_exposure: M,
      leadership_governance: L,
      semantic_similarity: { value: calFull[i], note: `Cosine ${cosFull[i].toFixed(3)} → pool percentile ${Math.round(calFull[i] * 100)}%` },
      network_connector_evidence: N,
      data_confidence: C,
    };
    const observedWeight = FEATURES.reduce((a, f) => a + (raw[f.key].value === null ? 0 : config.weights[f.key]), 0) || 1;
    const components: ScoreComponent[] = FEATURES.map((f) => {
      const v = raw[f.key].value;
      return {
        key: f.key,
        label: f.label,
        short: f.short,
        weight: config.weights[f.key],
        value: v === null ? null : r2(v),
        contribution: v === null ? 0 : Math.round(((100 * config.weights[f.key] * v) / observedWeight) * 10) / 10,
        note: raw[f.key].note,
      };
    });
    let score = components.reduce((a, x) => a + x.contribution, 0);
    const warnings: string[] = [];
    if (S.value < config.gate.min_school_relevance && score > config.gate.cap) {
      score = config.gate.cap;
      warnings.push("capped_by_school_evidence_gate");
    } else if (S.value < config.gate.min_school_relevance) {
      warnings.push("weak_school_evidence");
    }
    score = Math.round(score * 10) / 10;
    const exp = buildExplanation({ person: c.person, evidence: c.evidence, sources: c.sources, components, completeness, asOf, warnings });
    const label: ScoredCandidate["confidenceLabel"] =
      C.value >= 0.7 && completeness >= 0.75 ? "High" : C.value >= 0.5 && completeness >= 0.55 ? "Medium" : "Limited evidence";
    if (label === "Limited evidence") warnings.push("limited_evidence");
    const inf = info.get(c.person.id) ?? { lexicalRank: null, vectorRank: null, rrf: 0 };
    return {
      personId: c.person.id,
      score,
      components,
      explanation: exp.explanation,
      factors: exp.factors,
      limitations: exp.limitations,
      warnings,
      evidenceIds: exp.evidenceIds,
      completeness,
      confidenceLabel: label,
      retrieval: { ...inf, cosine: r2(cosFull[i]) },
    };
  });
}

/** Stable ordering: score desc, then data confidence, then id — fixed input => fixed output. */
export function sortScored(list: ScoredCandidate[]): ScoredCandidate[] {
  const conf = (s: ScoredCandidate) => s.components.find((c) => c.key === "data_confidence")?.value ?? 0;
  return [...list].sort((a, b) => b.score - a.score || conf(b) - conf(a) || a.personId.localeCompare(b.personId));
}

/** Optional MMR diversity re-rank (off by default). */
export function diversify(list: ScoredCandidate[], persons: Map<string, PersonRow>, lambda: number): ScoredCandidate[] {
  const remaining = [...list];
  const chosen: ScoredCandidate[] = [];
  const sim = (a: PersonRow, b: PersonRow) => {
    const sameOrg = a.currentOrganisation && a.currentOrganisation === b.currentOrganisation ? 1 : 0;
    const fa = new Set(a.roleFamilies);
    const fb = new Set(b.roleFamilies);
    const inter = [...fa].filter((x) => fb.has(x)).length;
    const uni = new Set([...fa, ...fb]).size || 1;
    return 0.4 * sameOrg + 0.6 * (inter / uni);
  };
  while (remaining.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    remaining.forEach((cand, idx) => {
      const p = persons.get(cand.personId)!;
      const maxSim = chosen.length ? Math.max(...chosen.map((s) => sim(p, persons.get(s.personId)!))) : 0;
      const val = lambda * (cand.score / 100) - (1 - lambda) * maxSim;
      if (val > bestVal + 1e-9) {
        bestVal = val;
        bestIdx = idx;
      }
    });
    chosen.push(remaining.splice(bestIdx, 1)[0]);
  }
  return chosen;
}
