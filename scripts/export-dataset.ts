import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATASET_META, RECORDS, splitFor } from "../src/data/india-school-ecosystem-v1";
import { toCsv } from "../src/lib/csv";
import { CLAIM_TYPES, SOURCE_TYPES } from "../src/lib/taxonomy";

/**
 * Writes the versioned dataset files (persons/sources/evidence/labels CSV + manifest.json)
 * to data/datasets/<version>/: `npx tsx scripts/export-dataset.ts`
 */
const dir = join(process.cwd(), "data", "datasets", DATASET_META.version);
mkdirSync(dir, { recursive: true });

const files: Record<string, string> = {
  "persons.csv": toCsv(
    ["record_key", "display_name", "current_title", "current_organisation", "city", "role_status", "school_exposure", "role_families", "school_roles", "sector_tags", "evidence_quality", "last_verified_at", "profile_url", "duplicate_of", "is_reference_self_record", "biography"],
    RECORDS.map((r) => [r.key, r.name, r.title, r.org, r.city, r.status, r.exp, r.fam.join("|"), r.roles.join("|"), r.tags.join("|"), r.q, r.v, "", r.dupOf ?? "", r.self ? "true" : "false", r.bio]),
  ),
  "sources.csv": toCsv(
    ["source_id", "record_key", "source_name", "source_type", "source_url", "publisher_or_owner", "access_method", "data_origin", "retrieved_at", "verification_status"],
    RECORDS.map((r) => [`src_${r.key}`, r.key, `${SOURCE_TYPES[r.src]} — ${r.org}`, r.src, "", "EDXSO synthetic fixture", "synthetic_fixture_import", "synthetic", r.v, r.q === "high" ? "fixture_reviewed" : r.q === "medium" ? "fixture_partially_reviewed" : "unreviewed"]),
  ),
  "evidence.csv": toCsv(
    ["evidence_id", "record_key", "source_id", "claim_type", "claim_text", "excerpt", "source_locator", "observed_at"],
    RECORDS.flatMap((r) => r.ev.map(([c, e], i) => [`ev_${r.key}_${i + 1}`, r.key, `src_${r.key}`, c, CLAIM_TYPES[c].label, e, "biography", r.v])),
  ),
  "labels.csv": toCsv(
    ["reference_id", "record_key", "grade_0_to_3", "split", "annotator"],
    RECORDS.filter((r) => r.label !== undefined && r.key !== "self-a" && !r.dupOf).map((r, i) => ["demo-ref-001", r.key, r.label, splitFor(i), "fixture-author (single annotator)"]),
  ),
};

const checksums: Record<string, string> = {};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(dir, name), content);
  checksums[name] = createHash("sha256").update(readFileSync(join(dir, name))).digest("hex");
}

writeFileSync(
  join(dir, "manifest.json"),
  JSON.stringify(
    {
      version: DATASET_META.version,
      title: DATASET_META.title,
      data_origin: DATASET_META.origin,
      as_of: DATASET_META.asOf,
      counts: {
        source_records: RECORDS.length,
        evidence_items: RECORDS.reduce((a, r) => a + r.ev.length, 0),
        labelled_people: RECORDS.filter((r) => r.label !== undefined && r.key !== "self-a" && !r.dupOf).length,
      },
      licence_notes: DATASET_META.licenceNotes,
      sha256: checksums,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Wrote ${Object.keys(files).length + 1} files to ${dir}`);
