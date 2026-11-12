import { eq } from "drizzle-orm";
import { db } from "@/db";
import { relevanceLabels, referenceProfiles } from "@/db/schema";
import { analyseReference } from "./analysis";
import { getActiveConfig } from "./config";
import { discover } from "./pipeline";
import { ensureSeeded } from "./seed";

export interface Metrics {
  n_labelled: number;
  n_relevant: number;
  p_at_5: number;
  p_at_10: number;
  recall_at_20: number;
  ndcg_at_10: number;
  mrr: number;
}

export interface EvaluationReport {
  reference: string;
  datasetVersion: string;
  rankerVersion: string;
  gainScheme: string;
  labelNote: string;
  splits: Record<"all" | "train" | "heldout", Record<"keyword" | "embedding" | "hybrid", Metrics>>;
  topGrades: { rank: number; name: string; grade: number; score: number }[];
  coverage: number;
  duplicateRate: number;
  unsupportedClaimRate: number;
  gradeDistribution: Record<string, number>;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function computeMetrics(ranked: string[], grades: Map<string, number>): Metrics {
  const list = ranked.filter((id) => grades.has(id));
  const rel = (id: string) => (grades.get(id) ?? 0) >= 2;
  const totalRel = [...grades.values()].filter((g) => g >= 2).length;
  const atK = (k: number) => list.slice(0, k);
  const p = (k: number) => (k === 0 ? 0 : atK(k).filter(rel).length / Math.min(k, Math.max(list.length, 1)));
  const dcg = (ids: string[]) => ids.reduce((a, id, i) => a + (Math.pow(2, grades.get(id) ?? 0) - 1) / Math.log2(i + 2), 0);
  const ideal = [...grades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
  const firstHigh = list.findIndex((id) => (grades.get(id) ?? 0) >= 3);
  return {
    n_labelled: grades.size,
    n_relevant: totalRel,
    p_at_5: r3(p(5)),
    p_at_10: r3(p(10)),
    recall_at_20: r3(totalRel ? atK(20).filter(rel).length / totalRel : 0),
    ndcg_at_10: r3(dcg(atK(10)) / (dcg(ideal) || 1)),
    mrr: r3(firstHigh === -1 ? 0 : 1 / (firstHigh + 1)),
  };
}

export async function evaluate(): Promise<EvaluationReport> {
  await ensureSeeded();
  const config = await getActiveConfig();
  const [ref] = await db.select().from(referenceProfiles).where(eq(referenceProfiles.id, "demo-ref-001")).limit(1);
  const labels = await db.select().from(relevanceLabels).where(eq(relevanceLabels.referenceId, "demo-ref-001"));
  const analysis = analyseReference({ displayName: ref.displayName, profileText: ref.profileText, currentRole: ref.currentRole, organisation: ref.organisation, location: ref.location });
  const out = await discover({ analysis, config, fullPool: true });
  const eligible = new Set(out.scored.map((s) => s.personId));

  const lists = {
    keyword: out.lexical.map((x) => x.id).filter((id) => eligible.has(id)),
    embedding: out.vector.map((x) => x.id).filter((id) => eligible.has(id)),
    hybrid: out.scored.map((s) => s.personId),
  };
  const gradeMap = (split?: string) => new Map(labels.filter((l) => !split || l.split === split).map((l) => [l.personId, l.grade]));
  const mk = (split?: string) => ({
    keyword: computeMetrics(lists.keyword, gradeMap(split)),
    embedding: computeMetrics(lists.embedding, gradeMap(split)),
    hybrid: computeMetrics(lists.hybrid, gradeMap(split)),
  });

  const top20 = out.scored.slice(0, 20);
  const nameOf = (id: string) => out.corpus.candidates.get(id)?.person.displayName ?? id;
  const names = top20.map((s) => nameOf(s.personId));
  const full = gradeMap();
  const dist: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 };
  labels.forEach((l) => dist[String(l.grade)]++);
  return {
    reference: ref.displayName,
    datasetVersion: out.corpus.datasetVersion,
    rankerVersion: config.version,
    gainScheme: "nDCG gain = 2^grade − 1; relevant = grade ≥ 2; MRR uses first grade-3 result",
    labelNote:
      "Labels were assigned by the fixture author using the written 0–3 rubric (single annotator, synthetic records). There is no second reviewer, so inter-annotator agreement is not measured. Results demonstrate the harness, not real-world accuracy.",
    splits: { all: mk(), train: mk("train"), heldout: mk("heldout") },
    topGrades: top20.map((s, i) => ({ rank: i + 1, name: names[i], grade: full.get(s.personId) ?? -1, score: s.score })),
    coverage: r3(top20.filter((s) => (out.corpus.candidates.get(s.personId)?.evidence.length ?? 0) >= 2 && (out.corpus.candidates.get(s.personId)?.sources.length ?? 0) >= 1).length / Math.max(top20.length, 1)),
    duplicateRate: r3(1 - new Set(names.map((n) => n.toLowerCase())).size / Math.max(names.length, 1)),
    unsupportedClaimRate: r3(top20.filter((s) => s.explanation.startsWith("Explanation withheld")).length / Math.max(top20.length, 1)),
    gradeDistribution: dist,
  };
}
