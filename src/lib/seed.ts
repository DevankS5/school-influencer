import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  evidenceItems,
  importBatches,
  persons,
  profileEmbeddings,
  profileSources,
  rankingConfigs,
  referenceProfiles,
  relevanceLabels,
} from "@/db/schema";
import { DATASET_META, RECORDS, REFERENCES, splitFor, type RawRecord } from "@/data/india-school-ecosystem-v1";
import { DEFAULT_CONFIG } from "./config";
import { CLAIM_TYPES, INDIA_GAZETTEER, ROLE_FAMILIES, ROLE_FAMILIES as FAMILIES, SCHOOL_EXPOSURE, SOURCE_TYPES, TAXONOMY_VERSION } from "./taxonomy";
import { DOC_TEMPLATE_VERSION, EMBEDDING_DIM, EMBEDDING_MODEL, EMBEDDING_REVISION, embed, normaliseKey, sha1Like } from "./text";
import type { EvidenceQuality, SchoolExposure } from "./types";

const CONF: Record<EvidenceQuality, number> = { high: 0.92, medium: 0.78, low: 0.6 };
const QUALITY_RANK: Record<EvidenceQuality, number> = { high: 3, medium: 2, low: 1 };
const EXPOSURE_RANK: Record<SchoolExposure, number> = { school_group: 5, multi_school: 5, direct_single_school: 3, school_adjacent: 2, unknown: 0 };

function place(city: string) {
  const g = INDIA_GAZETTEER[city.toLowerCase()];
  return g ? { location: `${city}, ${g.region}`, region: g.region, country: g.country } : { location: city, region: null, country: null };
}

export function buildCandidateDocument(p: {
  title: string | null;
  org: string | null;
  career: string[];
  bio: string | null;
  roles: string[];
  tags: string[];
  exposure: string;
  evidence: string[];
  location: string | null;
}): string {
  return [
    `Role: ${p.title ?? ""}`,
    `Organisation: ${p.org ?? ""}`,
    `Career: ${p.career.join("; ")}`,
    `Professional summary: ${p.bio ?? ""}`,
    `School roles: ${p.roles.join(", ")}`,
    `Sector: ${p.tags.join(", ").replace(/_/g, " ")}`,
    `School exposure: ${p.exposure.replace(/_/g, " ")}`,
    `Evidence: ${p.evidence.join(" | ")}`,
    `Location: ${p.location ?? ""}`,
  ].join("\n");
}

function validateRecord(r: RawRecord): string[] {
  const problems: string[] = [];
  if (!r.name.trim()) problems.push("missing display name");
  if (!r.ev.length) problems.push("no evidence items (provenance policy)");
  for (const [claim, excerpt] of r.ev) {
    if (!(claim in CLAIM_TYPES)) problems.push(`unknown claim type ${claim}`);
    if (!r.bio.includes(excerpt)) problems.push(`evidence excerpt not found in source text: "${excerpt.slice(0, 40)}…"`);
  }
  for (const f of r.fam) if (!(f in FAMILIES)) problems.push(`unknown role family ${f}`);
  if (!(r.exp in SCHOOL_EXPOSURE)) problems.push(`unknown exposure ${r.exp}`);
  if (!(r.src in SOURCE_TYPES)) problems.push(`unknown source type ${r.src}`);
  if (Number.isNaN(Date.parse(r.v))) problems.push("invalid last_verified date");
  if (/^(test|unknown|n\/a)$/i.test(r.name.trim())) problems.push("placeholder name");
  return problems;
}

async function seedInTransaction() {
  const asOf = new Date(DATASET_META.asOf);
  const quarantined: { key: string; problems: string[] }[] = [];
  const valid: RawRecord[] = [];
  const seenKeys = new Set<string>();
  for (const r of RECORDS) {
    const problems = validateRecord(r);
    if (seenKeys.has(r.key)) problems.push("duplicate stable id");
    seenKeys.add(r.key);
    if (problems.length) quarantined.push({ key: r.key, problems });
    else valid.push(r);
  }

  // ── Conservative entity resolution: name + organisation + region must all match.
  const groups = new Map<string, RawRecord[]>();
  for (const r of valid) {
    const k = `${normaliseKey(r.name)}|${normaliseKey(r.org)}|${normaliseKey(place(r.city).region ?? r.city)}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const byName = new Map<string, string[]>();
  for (const [k, recs] of groups) {
    const n = k.split("|")[0];
    byName.set(n, [...(byName.get(n) ?? []), recs[0].key]);
  }
  const ambiguous = [...byName.entries()].filter(([, ks]) => ks.length > 1).map(([name, keys]) => ({ name, recordKeys: keys, action: "not merged — name alone is insufficient; flagged for manual review" }));

  const batchId = `batch_${DATASET_META.version}`;
  const personRows: (typeof persons.$inferInsert)[] = [];
  const sourceRows: (typeof profileSources.$inferInsert)[] = [];
  const evidenceRows: (typeof evidenceItems.$inferInsert)[] = [];
  const embeddingRows: (typeof profileEmbeddings.$inferInsert)[] = [];
  const labelRows: (typeof relevanceLabels.$inferInsert)[] = [];
  let merged = 0;
  let labelIdx = 0;

  for (const recs of groups.values()) {
    const primary = recs.find((r) => !r.dupOf) ?? recs[0];
    const pid = `per_${primary.key}`;
    const pl = place(primary.city);
    const exposure = recs.reduce((best, r) => (EXPOSURE_RANK[r.exp] > EXPOSURE_RANK[best] ? r.exp : best), primary.exp);
    const quality = recs.reduce((best, r) => (QUALITY_RANK[r.q] > QUALITY_RANK[best] ? r.q : best), primary.q);
    const lastVerified = recs.map((r) => r.v).sort().at(-1)!;
    const tags = [...new Set(recs.flatMap((r) => r.tags))];
    const roles = [...new Set(recs.flatMap((r) => r.roles))];
    const fams = [...new Set(recs.flatMap((r) => r.fam))];
    const evidenceSummaries = recs.flatMap((r) => r.ev.map(([c, e]) => `${CLAIM_TYPES[c].label}: ${e}`));
    const doc = buildCandidateDocument({
      title: primary.title, org: primary.org, career: primary.career, bio: recs.map((r) => r.bio).join(" "),
      roles, tags, exposure, evidence: evidenceSummaries, location: pl.location,
    });
    if (recs.length > 1) merged += recs.length - 1;

    personRows.push({
      id: pid, batchId, displayName: primary.name, currentTitle: primary.title,
      currentOrganisation: primary.org === "Independent" ? null : primary.org,
      location: pl.location, region: pl.region, country: pl.country, profileUrl: null,
      biography: primary.bio,
      careerHistory: primary.career.map((c) => { const [role, organisation, period] = c.split("|").map((s) => s.trim()); return { role, organisation, period: period ?? null }; }),
      sectorTags: tags, schoolRoles: roles, roleFamilies: fams, schoolExposure: exposure,
      roleStatus: primary.status, evidenceQuality: quality, lastVerifiedAt: new Date(lastVerified),
      searchDoc: doc,
      resolution: recs.length > 1
        ? { merged_source_records: recs.map((r) => r.key), match_score: 0.92, reason: "normalised name + organisation + region match across source records" }
        : { merged_source_records: [primary.key], match_score: 1, reason: "single source record" },
    });

    for (const r of recs) {
      const sid = `src_${r.key}`;
      const body = r.bio;
      sourceRows.push({
        id: sid, personId: pid,
        sourceName: `${SOURCE_TYPES[r.src]} — ${r.org}`,
        sourceType: r.src, sourceUrl: null,
        publisherOrOwner: "EDXSO synthetic fixture",
        accessMethod: "synthetic_fixture_import",
        permissionNotes: "Fictional record authored for pipeline testing. No real person. No URL by design.",
        dataOrigin: "synthetic",
        retrievedAt: new Date(r.v), publishedAt: null,
        contentHash: sha1Like(body),
        fieldCoverage: ["display_name", "title", "organisation", "location", "biography", ...(r.career.length ? ["career_history"] : [])],
        verificationStatus: r.q === "high" ? "fixture_reviewed" : r.q === "medium" ? "fixture_partially_reviewed" : "unreviewed",
        notes: r.src === "conference_speaker_bio" ? "Event biography: historical evidence only; current role not confirmed." : null,
      });
      r.ev.forEach(([claim, excerpt], i) => {
        evidenceRows.push({
          id: `ev_${r.key}_${i + 1}`, personId: pid, sourceId: sid, claimType: claim,
          claimText: CLAIM_TYPES[claim].label, excerpt, sourceLocator: "biography",
          observedAt: new Date(r.v), confidence: CONF[r.q],
          reviewStatus: r.q === "low" ? "unreviewed" : "reviewed",
        });
      });
    }

    embeddingRows.push({
      id: `emb_${pid}`, personId: pid, modelName: EMBEDDING_MODEL, modelRevision: EMBEDDING_REVISION,
      templateVersion: DOC_TEMPLATE_VERSION, dimension: EMBEDDING_DIM,
      embedding: embed(doc),
      roleEmbedding: embed([primary.title, roles.join(" "), fams.map((f) => ROLE_FAMILIES[f]).join(" "), primary.org].join(" ")),
    });

    if (primary.label !== undefined && primary.key !== "self-a") {
      labelRows.push({
        id: `lbl_ref001_${primary.key}`, referenceId: "demo-ref-001", personId: pid, grade: primary.label,
        split: splitFor(labelIdx++), annotator: "fixture-author (single annotator)",
        rationale: ["not relevant", "weak / adjacent", "relevant", "highly relevant"][primary.label],
      });
    }
  }

  const real = personRows.filter((p) => !p.id.startsWith("per_self"));
  const withEvidence = (pred: (c: keyof typeof CLAIM_TYPES) => boolean) =>
    new Set(evidenceRows.filter((e) => pred(e.claimType as keyof typeof CLAIM_TYPES)).map((e) => e.personId)).size;
  const stale = personRows.filter((p) => p.lastVerifiedAt && asOf.getTime() - p.lastVerifiedAt.getTime() > 365 * 86400000).length;
  const quality = {
    total_people: personRows.length,
    total_source_records: sourceRows.length,
    total_evidence_items: evidenceRows.length,
    records_with_profile_urls: personRows.filter((p) => p.profileUrl).length,
    records_with_current_role: personRows.filter((p) => p.currentTitle && p.roleStatus === "current").length,
    records_with_school_specific_evidence: withEvidence((c) => CLAIM_TYPES[c].s >= 0.5),
    records_with_multi_school_evidence: withEvidence((c) => (CLAIM_TYPES[c].multi ?? 0) >= 0.7),
    records_with_stale_verification: stale,
    duplicates_merged: merged,
    ambiguous_same_name_flags: ambiguous,
    quarantined_records: quarantined,
    sources_by_type: sourceRows.reduce<Record<string, number>>((a, s) => ({ ...a, [s.sourceType]: (a[s.sourceType] ?? 0) + 1 }), {}),
    reference_people_in_corpus: personRows.length - real.length,
    taxonomy_version: TAXONOMY_VERSION,
    embedding_model: `${EMBEDDING_MODEL}@${EMBEDDING_REVISION}`,
    checks: ["required fields", "controlled taxonomy values", "evidence excerpt exists in source text", "unique stable ids", "valid verification dates", "no fabricated profile URLs", "no placeholder names"],
  };

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(727001)`);
    const exists = await tx.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.datasetVersion, DATASET_META.version)).limit(1);
    if (exists.length) return;

    await tx.insert(importBatches).values({
      id: batchId, datasetVersion: DATASET_META.version, dataOrigin: DATASET_META.origin,
      title: DATASET_META.title, description: DATASET_META.description, licenceNotes: DATASET_META.licenceNotes,
      asOf,
      stats: { people: personRows.length, sources: sourceRows.length, evidence: evidenceRows.length, labels: labelRows.length, quarantined: quarantined.length },
      qualityReport: quality,
    });
    await tx.insert(persons).values(personRows);
    await tx.insert(profileSources).values(sourceRows);
    await tx.insert(evidenceItems).values(evidenceRows);
    await tx.insert(profileEmbeddings).values(embeddingRows);
    if (labelRows.length) await tx.insert(relevanceLabels).values(labelRows);
    await tx.insert(referenceProfiles).values(
      REFERENCES.map((r, i) => ({
        id: r.id, displayName: r.displayName, currentRole: r.currentRole, organisation: r.organisation,
        location: r.location, profileText: r.profileText, headline: r.headline, isSynthetic: true, sortOrder: i,
      })),
    ).onConflictDoNothing();
    await tx.insert(rankingConfigs).values({
      id: `cfg_${DEFAULT_CONFIG.version}`, version: DEFAULT_CONFIG.version,
      config: DEFAULT_CONFIG as unknown as Record<string, unknown>, isActive: true,
      notes: "Initial hypothesis weights from the methodology document. Not yet calibrated.",
    }).onConflictDoNothing();
  });
}

let seeding: Promise<void> | null = null;

/** Idempotent: imports the versioned dataset the first time any server path needs it. */
export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = (async () => {
      const rows = await db.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.datasetVersion, DATASET_META.version)).limit(1);
      if (!rows.length) await seedInTransaction();
    })().catch((e) => {
      seeding = null;
      throw e;
    });
  }
  return seeding;
}

export const ACTIVE_DATASET_VERSION = DATASET_META.version;
