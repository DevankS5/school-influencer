import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CandidateResultCard } from "@/components/CandidateResultCard";
import { FiltersToolbar } from "@/components/FiltersToolbar";
import { AnalysisSummary, DiscoveryRunStatus, ExportResultsButton, ReferenceProfilePreview } from "@/components/RunPanels";
import { parseResultFilters } from "@/lib/filters";
import { getRun, getRunResults } from "@/lib/pipeline";
import { ROLE_FAMILIES, SOURCE_TYPES } from "@/lib/taxonomy";
import type { RankingConfig, ReferenceAnalysis } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discovery results" };

const PAGE_SIZE = 20;

export default async function DiscoverPage({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { runId } = await params;
  const sp = await searchParams;
  const run = await getRun(runId);
  if (!run) notFound();

  const analysis = run.analysis as unknown as ReferenceAnalysis;
  const config = run.configSnapshot as unknown as RankingConfig;
  const defaultMin = Number((run.params as { minimum_score?: number }).minimum_score ?? config.results.default_minimum_score);
  const filters = parseResultFilters(sp, defaultMin);

  const [all, rows] = await Promise.all([getRunResults(runId, {}), getRunResults(runId, filters)]);
  const regions = [...new Set(all.map((r) => r.person.region).filter((x): x is string => !!x))].sort();
  const cats = [...new Set(all.flatMap((r) => r.person.roleFamilies))].filter((c) => c !== "unknown");
  const sources = [...new Set(all.flatMap((r) => r.sources.map((s) => s.sourceType)))];

  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const qsBase = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k === "page" || v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]])));
  const exportQs = qsBase.toString();
  const pageHref = (n: number) => {
    const q = new URLSearchParams(qsBase);
    if (n > 1) q.set("page", String(n));
    return `/discover/${runId}${q.toString() ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-8 pt-4">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/demo" className="hover:text-pine">Demo</Link> <span aria-hidden>/</span> <span>Run {runId.slice(4, 12)}</span>
      </nav>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Discovery results</p>
          <h1 className="display mt-1 text-4xl font-semibold leading-tight sm:text-5xl">
            {run.relevantCount} relevant professionals <span className="text-moss">for {run.referenceLabel}</span>
          </h1>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.9fr]">
        <ReferenceProfilePreview name={analysis.display_name} role={analysis.current_role} org={analysis.current_organisation} location={analysis.location} text={analysis.normalised_text} isSynthetic={run.referenceKind === "seeded"} />
        <DiscoveryRunStatus stats={run.retrievalStats} candidateCount={run.candidateCount} relevantCount={run.relevantCount} minScore={defaultMin} latencyMs={run.latencyMs} datasetVersion={run.datasetVersion} rankerVersion={run.rankerVersion} />
      </div>

      <AnalysisSummary a={analysis} />

      <section className="space-y-5" aria-label="Ranked candidates">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Step 2 · Ranked shortlist</p>
            <h2 className="display mt-1 text-3xl font-semibold">
              {rows.length} shown <span className="text-lg font-normal text-muted">of {all.length} eligible candidates</span>
            </h2>
          </div>
          <ExportResultsButton runId={runId} query={exportQs} />
        </div>

        <Suspense fallback={<div className="card-flat h-24" />}>
          <FiltersToolbar
            options={{
              regions,
              categories: cats.map((c) => ({ value: c, label: ROLE_FAMILIES[c as keyof typeof ROLE_FAMILIES] ?? c })),
              sources: sources.map((s) => ({ value: s, label: SOURCE_TYPES[s as keyof typeof SOURCE_TYPES] ?? s })),
              defaultMin,
            }}
          />
        </Suspense>

        {pageRows.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="display text-2xl font-semibold">No candidates match these filters</p>
            <p className="mt-2 text-sm text-muted">The threshold is never lowered silently. Reset the filters or lower the minimum score yourself.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pageRows.map((r, i) => (
              <CandidateResultCard key={r.person.id} row={r} runId={runId} bands={config.bands} position={(page - 1) * PAGE_SIZE + i + 1} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Pagination">
            {page > 1 && <Link className="btn-ghost" href={pageHref(page - 1)}>← Previous</Link>}
            <span className="rounded-full bg-mist px-4 py-2 text-sm font-medium text-pine">Page {page} of {pages}</span>
            {page < pages && <Link className="btn-ghost" href={pageHref(page + 1)}>Next →</Link>}
          </nav>
        )}
        <p className="pt-2 text-center text-xs leading-relaxed text-muted">
          A high score means documented, school-specific evidence in the source record. It is not a claim of personal influence, availability, or any connection to the reference person.
        </p>
      </section>
    </div>
  );
}
