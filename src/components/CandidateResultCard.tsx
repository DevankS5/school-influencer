import Link from "next/link";
import { bandTone, fmtDate } from "@/lib/format";
import type { ResultRow } from "@/lib/pipeline";
import { ROLE_FAMILIES, SCHOOL_EXPOSURE } from "@/lib/taxonomy";
import type { RoleFamily, SchoolExposure } from "@/lib/types";
import { EvidencePanel, ScoreBreakdown, ScoreRing } from "./ResultParts";

export function CandidateResultCard({
  row,
  runId,
  bands,
  position,
}: {
  row: ResultRow;
  runId: string;
  bands: { high: number; strong: number; moderate: number };
  position: number;
}) {
  const p = row.person;
  const tone = bandTone(row.score, bands);
  const cited = row.factors.flatMap((f) => f.evidenceIds);
  const confTone = row.confidenceLabel === "High" ? "chip" : row.confidenceLabel === "Medium" ? "chip-brass" : "chip-clay";
  const synthetic = row.sources.some((s) => s.dataOrigin === "synthetic");

  return (
    <article className="card rise overflow-hidden" style={{ animationDelay: `${Math.min(position, 12) * 35}ms` }}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-center sm:gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fog text-xs font-bold text-pine ring-1 ring-line">{position}</span>
          <ScoreRing score={row.score} stroke={tone.stroke} />
          <span className={`${tone.chip} whitespace-nowrap`}>{tone.label}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div>
              <h3 className="display text-[22px] font-semibold leading-tight text-ink">
                <Link href={`/candidates/${p.id}?run=${runId}`} className="decoration-sage decoration-2 underline-offset-4 hover:underline">
                  {p.displayName}
                </Link>
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                {p.currentTitle ?? "Role not stated"}
                {p.currentOrganisation ? <> · <span className="text-ink/80">{p.currentOrganisation}</span></> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={confTone}>{row.confidenceLabel === "Limited evidence" ? "Limited evidence" : `${row.confidenceLabel} confidence`}</span>
              {synthetic && <span className="chip-brass">Synthetic</span>}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.location && <span className="chip-line">{p.location}</span>}
            <span className="chip-line">{p.roleStatus === "former" ? "Former role" : p.roleStatus === "current" ? "Current role" : "Role status unknown"}</span>
            <span className="chip-line">{SCHOOL_EXPOSURE[p.schoolExposure as SchoolExposure]}</span>
            {(p.roleFamilies as RoleFamily[]).slice(0, 2).map((f) => (
              <span key={f} className="chip">{ROLE_FAMILIES[f]}</span>
            ))}
          </div>

          <p className="mt-4 text-[15px] leading-relaxed text-ink/90">{row.explanation}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span>{row.evidence.length} evidence item{row.evidence.length === 1 ? "" : "s"}</span>
            <span>{row.sources.length} source record{row.sources.length === 1 ? "" : "s"}</span>
            <span>Verified {fmtDate(p.lastVerifiedAt)}</span>
            <span>Completeness {Math.round(row.completeness * 100)}%</span>
            <span className="font-mono text-[10px]">lex #{row.retrieval.lexicalRank ?? "–"} · vec #{row.retrieval.vectorRank ?? "–"}</span>
          </div>
        </div>
      </div>

      <details className="group border-t border-line bg-fog/50">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5 text-sm font-medium text-pine transition hover:bg-mist/60 sm:px-6">
          <span>Score breakdown, evidence &amp; provenance</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-base ring-1 ring-line transition group-open:rotate-45">+</span>
        </summary>
        <div className="grid gap-8 px-5 pb-6 pt-3 sm:px-6 lg:grid-cols-2">
          <div className="space-y-6">
            <ScoreBreakdown components={row.components} score={row.score} />
            {row.limitations.length > 0 && (
              <div>
                <h4 className="eyebrow">Data limitations</h4>
                <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted">
                  {row.limitations.map((l) => (
                    <li key={l} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <EvidencePanel evidence={row.evidence} sources={row.sources} highlight={cited} />
        </div>
      </details>
    </article>
  );
}
