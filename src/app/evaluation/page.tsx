import type { Metadata } from "next";
import { evaluate, type Metrics } from "@/lib/evaluation";

export const metadata: Metadata = { title: "Evaluation" };
export const dynamic = "force-dynamic";

const COLS: { k: keyof Metrics; l: string }[] = [
  { k: "p_at_5", l: "P@5" },
  { k: "p_at_10", l: "P@10" },
  { k: "recall_at_20", l: "Recall@20" },
  { k: "ndcg_at_10", l: "nDCG@10" },
  { k: "mrr", l: "MRR" },
];
const NAMES = { keyword: "Keyword only (FTS)", embedding: "Embedding only", hybrid: "Hybrid (RRF + ranker)" } as const;
const GRADE_TONE = ["bg-clay-soft text-clay", "bg-brass-soft text-[#7a5614]", "bg-mist text-pine", "bg-pine text-paper"];

function MetricTable({ title, sub, data }: { title: string; sub: string; data: Record<keyof typeof NAMES, Metrics> }) {
  const best = (k: keyof Metrics) => Math.max(...(Object.keys(NAMES) as (keyof typeof NAMES)[]).map((n) => Number(data[n][k])));
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pb-3 pt-6">
        <h3 className="display text-2xl font-semibold">{title}</h3>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      <div className="overflow-x-auto px-3 pb-4">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted">
              <th className="px-3 py-2 font-semibold">Method</th>
              {COLS.map((c) => <th key={c.k} className="px-3 py-2 text-right font-semibold">{c.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(NAMES) as (keyof typeof NAMES)[]).map((n) => (
              <tr key={n} className="border-t border-line/70">
                <td className="px-3 py-3 font-medium">{NAMES[n]}</td>
                {COLS.map((c) => {
                  const v = Number(data[n][c.k]);
                  const top = v === best(c.k);
                  return (
                    <td key={c.k} className="px-3 py-3 text-right">
                      <span className={`inline-block min-w-[56px] rounded-full px-2.5 py-1 tabular-nums ${top ? "bg-mist font-semibold text-pine" : "text-muted"}`}>{v.toFixed(3)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function EvaluationPage() {
  const r = await evaluate();
  const h = r.splits.heldout.hybrid;
  return (
    <div className="space-y-10 pt-6">
      <header className="max-w-3xl">
        <p className="eyebrow">Ranking quality</p>
        <h1 className="display mt-2 text-5xl font-semibold leading-[1.05]">Does hybrid beat the baselines?</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Computed live for <strong className="text-ink">{r.reference}</strong> on <span className="font-mono text-sm">{r.datasetVersion}</span> with ranker <span className="font-mono text-sm">{r.rankerVersion}</span>. Relevant means a label of 2 or 3.
        </p>
      </header>

      <div className="rounded-3xl border border-brass/40 bg-brass-soft/60 p-5 text-sm leading-relaxed text-[#5f430f]">
        <strong>Read this before quoting a number.</strong> {r.labelNote} With only {h.n_labelled} held-out-eligible labels and an easy synthetic corpus, differences between methods are not statistically meaningful. The 0.70 Precision@10 target is a measurement, not a claim.
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MetricTable title="Held-out split" sub={`${r.splits.heldout.hybrid.n_labelled} labelled · ${r.splits.heldout.hybrid.n_relevant} relevant`} data={r.splits.heldout} />
        <MetricTable title="Training split" sub={`${r.splits.train.hybrid.n_labelled} labelled · ${r.splits.train.hybrid.n_relevant} relevant — safe for tuning`} data={r.splits.train} />
      </div>
      <MetricTable title="All labels" sub={`${r.splits.all.hybrid.n_labelled} labelled · ${r.splits.all.hybrid.n_relevant} relevant`} data={r.splits.all} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <h3 className="display text-2xl font-semibold">Top 20, graded</h3>
          <p className="mt-1 text-xs text-muted">Each disc is one result in rank order, coloured by its human-style label (0–3).</p>
          <ol className="mt-5 grid gap-2 sm:grid-cols-2">
            {r.topGrades.map((t) => (
              <li key={t.rank} className="flex items-center gap-3 rounded-full border border-line bg-white/60 py-1.5 pl-1.5 pr-4 text-sm">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${GRADE_TONE[Math.max(0, t.grade)]}`}>{t.grade < 0 ? "?" : t.grade}</span>
                <span className="truncate">{t.rank}. {t.name}</span>
                <span className="ml-auto text-xs tabular-nums text-muted">{t.score.toFixed(0)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="space-y-4">
          <div className="card p-6">
            <h3 className="display text-xl font-semibold">Quality gates</h3>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Evidence coverage (top 20)", `${Math.round(r.coverage * 100)}%`],
                ["Duplicate rate (top 20)", `${Math.round(r.duplicateRate * 100)}%`],
                ["Unsupported explanation claims", `${Math.round(r.unsupportedClaimRate * 100)}%`],
                ["Grade distribution 0/1/2/3", Object.values(r.gradeDistribution).join(" / ")],
              ].map(([l, v]) => (
                <div key={l} className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2 last:border-0"><dt className="text-muted">{l}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="card-flat p-5 text-xs leading-relaxed text-muted">
            <p className="eyebrow mb-2">Method</p>
            {r.gainScheme}. Split: every third labelled record is held out; tune weights on the training split only, then report the held-out column.
          </div>
        </section>
      </div>
    </div>
  );
}
