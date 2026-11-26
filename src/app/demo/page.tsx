import { ACTIVE } from "@/data/active";
import type { Metadata } from "next";
import Link from "next/link";
import { ReferenceProfilePreview } from "@/components/RunPanels";
import { RunDemoButton } from "@/components/RunForms";
import { fmtDate } from "@/lib/format";
import { listRecentRuns } from "@/lib/pipeline";
import { getReferences } from "@/lib/queries";

export const metadata: Metadata = { title: "Demo" };
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const [refs, runs] = await Promise.all([getReferences(), listRecentRuns(5)]);
  return (
    <div className="space-y-12 pt-6">
      <header className="max-w-3xl">
        <p className="eyebrow">Seeded references</p>
        <h1 className="display mt-2 text-5xl font-semibold leading-[1.05]">Pick a reference, watch the pipeline work</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          {ACTIVE.DATASET_META.origin === "synthetic" ? "Three fictional professionals act as reference profiles. The first is the designated demo: its corpus contains direct matches, adjacent roles and hard negatives, plus labelled relevance for evaluation." : "Three real professionals, taken from their organisations' own public pages, act as reference profiles. Every candidate in the corpus is a real person with a source URL and verbatim evidence."}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {refs.map((r, i) => (
            <div key={r.id} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
              <ReferenceProfilePreview name={r.displayName} role={r.currentRole} org={r.organisation} location={r.location} text={r.profileText} isSynthetic={r.isSynthetic} headline={r.headline} />
              <div className="-mt-3 flex flex-wrap items-center justify-between gap-3 rounded-b-[28px] border border-t-0 border-line bg-fog/70 px-6 pb-4 pt-6">
                <div className="flex flex-wrap gap-1.5">
                  {i === 0 ? <span className="chip-brass">Designated demo · labelled evaluation set</span> : <span className="chip-line">No labels · ranking only</span>}
                </div>
                <RunDemoButton referenceId={r.id} variant={i === 0 ? "primary" : "ghost"} />
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-6">
            <p className="eyebrow">5-minute walkthrough</p>
            <ol className="mt-4 space-y-4 text-sm">
              {[
                ["Run the designated demo", "Reference 1 returns 20+ candidates above the threshold."],
                ["Read the interpretation", "Check the evidence spans behind each extracted indicator."],
                ["Open a score breakdown", "Each of seven features shows value, weight and points."],
                ["Inspect provenance", "Quotes, source records, verification dates, limitations."],
                ["Filter, sort, export", "Try multi-school only, then export the CSV."],
                ["Check Evaluation", "Keyword vs embedding vs hybrid, with a held-out split."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mist text-[11px] font-bold text-pine">{i + 1}</span>
                  <span><strong className="font-semibold">{t}.</strong> <span className="text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </div>
          {runs.length > 0 && (
            <div className="card-flat p-5">
              <p className="eyebrow">Recent runs</p>
              <ul className="mt-3 space-y-2">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link href={`/discover/${r.id}`} className="flex items-center justify-between gap-3 rounded-full px-3 py-2 text-sm transition hover:bg-mist">
                      <span className="truncate">{r.referenceLabel}</span>
                      <span className="shrink-0 text-xs text-muted">{fmtDate(r.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
