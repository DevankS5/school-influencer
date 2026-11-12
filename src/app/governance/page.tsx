import type { Metadata } from "next";
import { CorrectionForm } from "@/components/CorrectionForm";
import { fmtDate } from "@/lib/format";
import { getBatch } from "@/lib/queries";

export const metadata: Metadata = { title: "Data governance" };
export const dynamic = "force-dynamic";

const MAY = [
  "“Ranked highly on documented school leadership and multi-school advisory experience.”",
  "“The source record was last checked on the displayed date.”",
  "“The semantic model found contextual similarity.”",
];
const MAY_NOT = [
  "That a person is connected to the reference person.",
  "That a person can influence school procurement.",
  "That a person has access to a given number of principals.",
  "That a candidate is guaranteed to be a decision-maker.",
  "Anything about a person's private network.",
];

export default async function GovernancePage() {
  const b = await getBatch();
  const q = b.qualityReport as Record<string, unknown>;
  const n = (k: string) => String(q[k] ?? 0);
  const ambiguous = (q.ambiguous_same_name_flags as { name: string; recordKeys: string[]; action: string }[]) ?? [];
  const metrics: [string, string][] = [
    ["Total people", n("total_people")],
    ["Source records", n("total_source_records")],
    ["With profile URLs", n("records_with_profile_urls")],
    ["With current role", n("records_with_current_role")],
    ["School-specific evidence", n("records_with_school_specific_evidence")],
    ["Multi-school evidence", n("records_with_multi_school_evidence")],
    ["Stale verification (>12 mo)", n("records_with_stale_verification")],
    ["Duplicates merged", n("duplicates_merged")],
    ["Quarantined", String((q.quarantined_records as unknown[] | undefined)?.length ?? 0)],
  ];

  return (
    <div className="space-y-14 pt-6">
      <header className="max-w-3xl">
        <p className="eyebrow">Data governance</p>
        <h1 className="display mt-2 text-5xl font-semibold leading-[1.05]">What the data is, and what it isn&apos;t</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">Relevance must be evidence-backed, explainable and traceable. A high score is never a claim of personal influence or a verified relationship.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card space-y-4 p-7">
          <div className="flex flex-wrap items-center gap-2"><span className="chip-brass">Synthetic test data</span><span className="chip-line font-mono">{b.datasetVersion}</span></div>
          <h2 className="display text-2xl font-semibold">{b.title}</h2>
          <p className="leading-relaxed text-ink/85">{b.description}</p>
          <p className="rounded-2xl bg-fog px-4 py-3 text-sm leading-relaxed text-muted"><strong className="text-ink">Licence &amp; permission:</strong> {b.licenceNotes}</p>
          <p className="rounded-2xl bg-clay-soft px-4 py-3 text-sm leading-relaxed text-clay">
            <strong>Assignment status:</strong> this dataset exercises the mechanics only. The success criterion of discovering 20+ <em>real</em>, lawfully sourced professionals remains <strong>unproven</strong> until a licensed or user-supplied real dataset is imported through the same pipeline.
          </p>
          <p className="text-xs text-muted">Dataset date {fmtDate(b.asOf)} · imported {fmtDate(b.createdAt)}</p>
        </div>
        <div className="card p-7">
          <p className="eyebrow">Import quality report</p>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            {metrics.map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-line bg-white/60 px-4 py-3">
                <dd className="display text-2xl font-semibold text-pine">{v}</dd>
                <dt className="text-xs text-muted">{l}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted">Checks: {(q.checks as string[]).join(" · ")}.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card p-7">
          <p className="eyebrow">LinkedIn boundary</p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
            {["No authenticated browsing, cookies or session reuse", "No CAPTCHA, login-wall or rate-limit circumvention", "No scraping of search results or profile pages", "No proxy rotation or stealth techniques", "URL input is policy-gated, never fetched"].map((x) => (
              <li key={x} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />{x}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Permitted alternatives: licensed data partners, official APIs, user-supplied exports, public biography pages with a source link.</p>
        </div>
        <div className="card p-7">
          <p className="eyebrow">The demo may say</p>
          <ul className="mt-4 space-y-2.5 text-sm italic leading-relaxed text-ink/85">{MAY.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="card p-7">
          <p className="eyebrow !text-clay">The demo must not claim</p>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">{MAY_NOT.map((x) => <li key={x} className="flex gap-2"><span className="text-clay">×</span>{x}</li>)}</ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-7">
          <p className="eyebrow">Entity resolution</p>
          <h2 className="display mt-1 text-2xl font-semibold">Conservative by design</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">Records merge only when normalised name, organisation <em>and</em> region all match. Name alone is never enough, and ambiguous cases are flagged for review rather than merged.</p>
          {ambiguous.length > 0 && (
            <ul className="mt-4 space-y-2">
              {ambiguous.map((a) => (
                <li key={a.name} className="rounded-2xl bg-brass-soft/60 px-4 py-3 text-xs leading-relaxed text-[#5f430f]"><strong className="capitalize">{a.name}</strong> — records {a.recordKeys.join(", ")}: {a.action}.</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Privacy: only professional fields needed for ranking are stored; evidence is a short excerpt, not a page copy. Reference text from pasted runs is kept only as its analysis. Retention schedule to be defined before any production use.</p>
        </div>
        <CorrectionForm />
      </section>
    </div>
  );
}
