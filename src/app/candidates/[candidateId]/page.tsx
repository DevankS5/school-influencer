import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CorrectionForm } from "@/components/CorrectionForm";
import { EvidencePanel, ScoreBreakdown, ScoreRing } from "@/components/ResultParts";
import { bandTone, fmtDate } from "@/lib/format";
import { getCandidate, getCandidateRunContext, getRun } from "@/lib/pipeline";
import { ROLE_FAMILIES, SCHOOL_EXPOSURE } from "@/lib/taxonomy";
import type { RankingConfig, RoleFamily, SchoolExposure, ScoreComponent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Candidate evidence" };

export default async function CandidatePage({ params, searchParams }: { params: Promise<{ candidateId: string }>; searchParams: Promise<{ run?: string }> }) {
  const { candidateId } = await params;
  const { run: runId } = await searchParams;
  const c = await getCandidate(candidateId);
  if (!c) notFound();
  const p = c.person;
  const ctx = runId ? await getCandidateRunContext(candidateId, runId) : null;
  const run = runId && ctx ? await getRun(runId) : null;
  const bands = run ? (run.configSnapshot as unknown as RankingConfig).bands : { high: 80, strong: 65, moderate: 45 };
  const tone = ctx ? bandTone(ctx.score, bands) : null;
  const synthetic = c.sources.some((s) => s.dataOrigin === "synthetic");
  const res = (p.resolution ?? {}) as { merged_source_records?: string[]; match_score?: number; reason?: string };

  return (
    <div className="space-y-8 pt-4">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        {run ? <Link href={`/discover/${run.id}`} className="hover:text-pine">← Back to results for {run.referenceLabel}</Link> : <Link href="/demo" className="hover:text-pine">← Demo</Link>}
      </nav>

      <header className="card flex flex-wrap items-center gap-6 p-7 sm:p-9">
        {ctx && tone && <ScoreRing score={ctx.score} stroke={tone.stroke} size={104} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {synthetic && <span className="chip-brass">Synthetic · fictional person</span>}
            <span className="chip-line">{p.roleStatus === "former" ? "Former role" : p.roleStatus === "current" ? "Current role" : "Role status unknown"}</span>
            {tone && <span className={tone.chip}>{tone.label}</span>}
          </div>
          <h1 className="display mt-3 text-4xl font-semibold leading-tight">{p.displayName}</h1>
          <p className="mt-1 text-muted">{p.currentTitle ?? "Role not stated"}{p.currentOrganisation ? ` · ${p.currentOrganisation}` : ""}{p.location ? ` · ${p.location}` : ""}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card space-y-6 p-7">
          <div>
            <h2 className="eyebrow">Source-backed biography</h2>
            <p className="mt-3 leading-relaxed text-ink/90">{p.biography}</p>
          </div>
          {p.careerHistory.length > 0 && (
            <div>
              <h2 className="eyebrow">Career history</h2>
              <ol className="mt-4 space-y-4 border-l-2 border-sage/60 pl-5">
                {p.careerHistory.map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-card bg-moss" />
                    <p className="text-sm font-semibold">{h.role}</p>
                    <p className="text-xs text-muted">{h.organisation}{h.period ? ` · ${h.period}` : ""}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h2 className="eyebrow">Taxonomy</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(p.roleFamilies as RoleFamily[]).map((f) => <span key={f} className="chip">{ROLE_FAMILIES[f]}</span>)}
                <span className="chip-line">{SCHOOL_EXPOSURE[p.schoolExposure as SchoolExposure]}</span>
              </div>
            </div>
            <div>
              <h2 className="eyebrow">Sector tags &amp; roles</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.sectorTags.map((t) => <span key={t} className="chip-line">{t.replace(/_/g, " ")}</span>)}
                {p.schoolRoles.map((t) => <span key={t} className="chip-brass">{t}</span>)}
              </div>
            </div>
          </div>
          <dl className="grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
            <div><dt className="eyebrow !text-muted">Last verified</dt><dd className="mt-1">{fmtDate(p.lastVerifiedAt)}</dd></div>
            <div><dt className="eyebrow !text-muted">Evidence quality</dt><dd className="mt-1 capitalize">{p.evidenceQuality}</dd></div>
            <div><dt className="eyebrow !text-muted">Profile URL</dt><dd className="mt-1 text-muted">{p.profileUrl ?? "None in source record"}</dd></div>
          </dl>
          <div className="rounded-2xl bg-fog px-4 py-3 text-xs leading-relaxed text-muted">
            <strong className="text-ink">Entity resolution:</strong> {res.reason ?? "—"} (match score {res.match_score ?? "—"}; source records: {(res.merged_source_records ?? []).join(", ")}). Name alone is never enough to merge two people.
          </div>
        </section>

        <aside className="space-y-6">
          {ctx && (
            <section className="card p-7">
              <ScoreBreakdown components={ctx.components as ScoreComponent[]} score={ctx.score} />
              <p className="mt-5 rounded-2xl bg-fog px-4 py-3 text-sm leading-relaxed">{ctx.explanation}</p>
              {ctx.limitations.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
                  {ctx.limitations.map((l) => <li key={l} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />{l}</li>)}
                </ul>
              )}
            </section>
          )}
          <CorrectionForm personId={p.id} personName={p.displayName} compact />
        </aside>
      </div>

      <section className="card p-7">
        <EvidencePanel evidence={c.evidence} sources={c.sources} highlight={ctx?.evidenceIds ?? []} />
      </section>
    </div>
  );
}
