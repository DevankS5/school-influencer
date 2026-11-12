import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { referenceProfiles } from "../src/db/schema";
import { analyseReference } from "../src/lib/analysis";
import { getActiveConfig } from "../src/lib/config";
import { evaluate } from "../src/lib/evaluation";
import { discover } from "../src/lib/pipeline";

/** Prints a ranked list for a seeded reference and the evaluation report: `npx tsx scripts/evaluate.ts [ref-id]` */
async function main() {
  const refId = process.argv[2] ?? "demo-ref-001";
  const config = await getActiveConfig();
  const { ensureSeeded } = await import("../src/lib/seed");
  await ensureSeeded();
  const [ref] = await db.select().from(referenceProfiles).where(eq(referenceProfiles.id, refId));
  const analysis = analyseReference({ displayName: ref.displayName, profileText: ref.profileText, currentRole: ref.currentRole, organisation: ref.organisation, location: ref.location });
  console.log("ANALYSIS", JSON.stringify({ ...analysis, normalised_text: undefined, reference_document: undefined }, null, 1).slice(0, 2500));
  const out = await discover({ analysis, config });
  console.log("STATS", JSON.stringify(out.stats));
  out.scored.forEach((s, i) => {
    const p = out.corpus.candidates.get(s.personId)!.person;
    console.log(String(i + 1).padStart(2), s.score.toFixed(1).padStart(5), p.displayName.padEnd(28), (p.currentTitle ?? "").slice(0, 34).padEnd(34), s.components.map((c) => (c.value === null ? " -- " : c.value.toFixed(2))).join(" "));
  });
  console.log("EVAL", JSON.stringify(await evaluate(), null, 1));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
