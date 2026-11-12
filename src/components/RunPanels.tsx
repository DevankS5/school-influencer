import { ROLE_FAMILIES, SCHOOL_EXPOSURE } from "@/lib/taxonomy";
import { pct } from "@/lib/format";
import type { ReferenceAnalysis, RoleFamily, SchoolExposure } from "@/lib/types";

export function ReferenceProfilePreview({ name, role, org, location, text, isSynthetic, headline }: {
  name: string; role?: string | null; org?: string | null; location?: string | null; text: string; isSynthetic?: boolean; headline?: string;
}) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="card p-6">
      <div className="flex items-start gap-4">
        <div className="display flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine text-lg font-semibold text-paper">{initials}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="display text-2xl font-semibold leading-tight">{name}</h2>
            {isSynthetic && <span className="chip-brass">Fictional</span>}
          </div>
          <p className="text-sm text-muted">{[role, org].filter(Boolean).join(" · ") || "Role not supplied"}{location ? ` · ${location}` : ""}</p>
          {headline && <p className="mt-1 text-sm italic text-moss">{headline}</p>}
        </div>
      </div>
      <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-ink/85">{text}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow !text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value ?? <span className="text-muted">— unknown</span>}</dd>
    </div>
  );
}

export function AnalysisSummary({ a }: { a: ReferenceAnalysis }) {
  return (
    <section className="card p-6 sm:p-7" aria-labelledby="analysis-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Step 1 · Structured interpretation</p>
          <h2 id="analysis-title" className="display mt-1 text-2xl font-semibold">How the system read this profile</h2>
        </div>
        <div className="flex items-center gap-3" title="Share of fields extracted with source-text support">
          <span className="text-xs text-muted">Analysis confidence</span>
          <div className="h-2.5 w-28 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-gradient-to-r from-moss to-pine" style={{ width: pct(a.analysis_confidence) }} /></div>
          <span className="text-sm font-semibold tabular-nums">{pct(a.analysis_confidence)}</span>
        </div>
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Current role" value={a.current_role} />
        <Field label="Organisation" value={a.current_organisation} />
        <Field label="Location" value={a.location} />
        <Field label="Seniority band" value={a.seniority_band === "unknown" ? null : a.seniority_band} />
        <Field label="School exposure" value={<span className="chip">{SCHOOL_EXPOSURE[a.school_exposure as SchoolExposure]}</span>} />
        <Field label="Multi-school" value={a.multi_school_exposure ? "Yes — evidenced" : "Not evidenced"} />
        <Field label="Role families" value={<span className="flex flex-wrap gap-1">{(a.role_families as RoleFamily[]).map((f) => <span key={f} className="chip">{ROLE_FAMILIES[f]}</span>)}</span>} />
        <Field label="Sector tags" value={a.sector_tags.length ? <span className="flex flex-wrap gap-1">{a.sector_tags.map((t) => <span key={t} className="chip-line">{t.replace(/_/g, " ")}</span>)}</span> : null} />
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="eyebrow">Leadership &amp; influence indicators</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {[...a.leadership_indicators, ...a.influence_indicators].map((x) => (
              <li key={x} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-moss" />{x}</li>
            ))}
            {!a.leadership_indicators.length && !a.influence_indicators.length && <li className="text-muted">None evidenced in the text.</li>}
          </ul>
          {a.missing_fields.length > 0 && (
            <div className="mt-4 rounded-2xl bg-brass-soft/60 px-4 py-3 text-xs text-[#6b4c12]">
              <strong>Not guessed — left empty:</strong> {a.missing_fields.map((m) => m.replace(/_/g, " ")).join(", ")}
            </div>
          )}
        </div>
        <details className="group rounded-2xl border border-line bg-white/60">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-pine">
            <span>Evidence spans ({a.evidence_spans.length})</span>
            <span className="text-lg transition group-open:rotate-45">+</span>
          </summary>
          <ul className="max-h-72 space-y-2 overflow-y-auto px-4 pb-4">
            {a.evidence_spans.map((s, i) => (
              <li key={`${s.indicator}-${i}`} className="text-xs">
                <span className="chip">{s.indicator.replace(":", " · ")}</span>
                <p className="mt-1 border-l-2 border-sage pl-2.5 italic leading-relaxed text-ink/80">“{s.text}” <span className="not-italic text-muted">[{s.start}–{s.end}]</span></p>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

export function DiscoveryRunStatus({ stats, candidateCount, relevantCount, minScore, latencyMs, datasetVersion, rankerVersion }: {
  stats: Record<string, unknown>; candidateCount: number; relevantCount: number; minScore: number; latencyMs: number; datasetVersion: string; rankerVersion: string;
}) {
  const removed = (stats.removed ?? {}) as Record<string, number>;
  const removedTotal = Object.values(removed).reduce((a, b) => a + b, 0);
  const met = relevantCount >= 20;
  const stages = [
    { t: "Analyse", d: "Structured profile", ok: true },
    { t: "Retrieve", d: `${stats.lexical_hits} lexical · ${stats.vector_hits} vector → ${stats.merged_pool} merged (RRF)`, ok: true },
    { t: "Filter", d: `${removedTotal} removed · ${removed.self_match ?? 0} self-match${(removed.outside_geography ?? 0) ? ` · ${removed.outside_geography} outside geography` : ""}`, ok: true },
    { t: "Rank", d: `${candidateCount} scored with ${rankerVersion}`, ok: true },
    { t: "Explain", d: "Evidence-cited templates", ok: true },
  ];
  return (
    <section className="card p-6" aria-label="Discovery run status">
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stages.map((s, i) => (
          <li key={s.t} className="relative flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine text-[11px] font-bold text-paper">{i + 1}</span>
            <div>
              <p className="text-sm font-semibold">{s.t}</p>
              <p className="text-xs leading-relaxed text-muted">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className={`mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-4 py-3 text-sm ${met ? "bg-mist text-pine" : "bg-clay-soft text-clay"}`}>
        <strong>{met ? `Target met — ${relevantCount} candidates scored ≥ ${minScore}` : `Shortfall — only ${relevantCount} candidate${relevantCount === 1 ? "" : "s"} scored ≥ ${minScore}`}</strong>
        <span className="text-xs opacity-80">{met ? "Threshold not lowered to reach 20." : "The threshold was not lowered and no results were padded."}</span>
        <span className="ml-auto font-mono text-[11px] opacity-80">{datasetVersion} · {latencyMs} ms</span>
      </div>
    </section>
  );
}

export function ExportResultsButton({ runId, query }: { runId: string; query: string }) {
  return (
    <a className="btn-ghost" href={`/api/v1/discovery-runs/${runId}/export${query ? `?${query}` : ""}`} download>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Export CSV
    </a>
  );
}
