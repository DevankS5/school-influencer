import "dotenv/config";
import { ensureSeeded } from "../src/lib/seed";
import { pool } from "../src/db";

/** Idempotent import of the versioned dataset: `npx tsx scripts/seed.ts` */
async function main() {
  await ensureSeeded();
  const r = await pool.query("select dataset_version, stats, quality_report from import_batches");
  for (const row of r.rows) {
    console.log(`dataset ${row.dataset_version}`, row.stats);
    const q = row.quality_report;
    console.log("  merged duplicates:", q.duplicates_merged, "| ambiguous same-name flags:", q.ambiguous_same_name_flags.length, "| quarantined:", q.quarantined_records.length);
    if (q.quarantined_records.length) console.log(JSON.stringify(q.quarantined_records, null, 2));
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
