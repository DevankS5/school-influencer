import { CLAIM_TYPES, SOURCE_TYPES } from "@/lib/taxonomy";
import { fmtDate, pct } from "@/lib/format";
import type { CandidateEvidence, CandidateSource, ScoreComponent } from "@/lib/types";

export function ScoreRing({ score, stroke, size = 76 }: { score: number; stroke: string; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Relevance score ${score.toFixed(0)} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e1ece1" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, score) / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="display text-[22px] font-semibold text-ink">{score.toFixed(0)}</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted">/ 100</span>
      </div>
    </div>
  );
}

export function SourceBadge({ source }: { source: Pick<CandidateSource, "sourceType" | "dataOrigin"> }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="chip-line">{SOURCE_TYPES[source.sourceType]}</span>
      {source.dataOrigin === "synthetic" && <span className="chip-brass">Synthetic</span>}
    </span>
  );
}

export function ScoreBreakdown({ components, score }: { components: ScoreComponent[]; score: number }) {
  const observed = components.filter((c) => c.value !== null);
  const wSum = observed.reduce((a, c) => a + c.weight, 0);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="eyebrow">Score components</h4>
        <p className="text-xs text-muted">
          Weights renormalised over {observed.length} observable feature{observed.length === 1 ? "" : "s"} (Σw = {wSum.toFixed(2)}) · final {score.toFixed(1)}
        </p>
      </div>
      <ul className="space-y-3.5">
        {components.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">
                {c.label} <span className="text-xs font-normal text-muted">· weight {pct(c.weight)}</span>
              </span>
              <span className="tabular-nums text-xs text-muted">
                {c.value === null ? "not observable" : `${c.value.toFixed(2)} → +${c.contribution.toFixed(1)} pts`}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-mist">
              <div
                className={`h-full rounded-full ${c.value === null ? "bg-[repeating-linear-gradient(45deg,#dcdfd1,#dcdfd1_4px,#eef3ea_4px,#eef3ea_8px)]" : "bg-gradient-to-r from-moss to-pine"}`}
                style={{ width: `${c.value === null ? 100 : Math.max(2, c.value * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{c.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EvidencePanel({
  evidence,
  sources,
  highlight = [],
}: {
  evidence: CandidateEvidence[];
  sources: CandidateSource[];
  highlight?: string[];
}) {
  const srcMap = new Map(sources.map((s) => [s.id, s]));
  return (
    <div className="space-y-6">
      <div>
        <h4 className="eyebrow">Evidence ({evidence.length})</h4>
        <ul className="mt-3 space-y-2.5">
          {evidence.map((e) => {
            const s = srcMap.get(e.sourceId);
            return (
              <li key={e.id} className={`rounded-2xl border px-4 py-3 ${highlight.includes(e.id) ? "border-moss/50 bg-fog" : "border-line bg-white/60"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{CLAIM_TYPES[e.claimType]?.label ?? e.claimType}</span>
                  {highlight.includes(e.id) && <span className="chip-brass">Cited in explanation</span>}
                  <span className="ml-auto font-mono text-[10px] text-muted">{e.id}</span>
                </div>
                <blockquote className="mt-2 border-l-2 border-sage pl-3 text-sm italic leading-relaxed text-ink/90">“{e.excerpt}”</blockquote>
                <p className="mt-2 text-xs text-muted">
                  {s ? s.sourceName : e.sourceId} · {e.sourceLocator} · confidence {pct(e.confidence)} · {e.reviewStatus}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h4 className="eyebrow">Provenance ({sources.length} source record{sources.length === 1 ? "" : "s"})</h4>
        <ul className="mt-3 space-y-2.5">
          {sources.map((s) => (
            <li key={s.id} className="rounded-2xl border border-line bg-white/60 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source={s} />
                <span className="chip-line">{s.verificationStatus.replace(/_/g, " ")}</span>
                <span className="ml-auto font-mono text-[10px] text-muted">{s.id}</span>
              </div>
              <dl className="mt-2.5 grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-2">
                <div><dt className="inline font-semibold text-ink/80">Publisher: </dt><dd className="inline">{s.publisherOrOwner}</dd></div>
                <div><dt className="inline font-semibold text-ink/80">Access method: </dt><dd className="inline">{s.accessMethod.replace(/_/g, " ")}</dd></div>
                <div><dt className="inline font-semibold text-ink/80">Retrieved: </dt><dd className="inline">{fmtDate(s.retrievedAt)}</dd></div>
                <div><dt className="inline font-semibold text-ink/80">Source URL: </dt><dd className="inline">{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline break-all">{s.sourceUrl}</a> : "none — not supplied by source record"}</dd></div>
                <div className="sm:col-span-2"><dt className="inline font-semibold text-ink/80">Permission: </dt><dd className="inline">{s.permissionNotes}</dd></div>
                {s.notes && <div className="sm:col-span-2 text-clay"><dt className="inline font-semibold">Note: </dt><dd className="inline">{s.notes}</dd></div>}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
