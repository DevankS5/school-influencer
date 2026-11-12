import { errorResponse } from "@/lib/http";
import { getRun } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await ctx.params;
    const run = await getRun(runId);
    if (!run) return Response.json({ error: "not_found", message: "Run not found." }, { status: 404 });
    const analysis = { ...(run.analysis as Record<string, unknown>) };
    delete analysis.reference_document;
    delete analysis.role_document;
    return Response.json({
      run_id: run.id,
      status: run.status,
      reference: { kind: run.referenceKind, id: run.referenceId, label: run.referenceLabel },
      reference_analysis: analysis,
      params: run.params,
      candidate_count: run.candidateCount,
      relevant_count: run.relevantCount,
      dataset_version: run.datasetVersion,
      ranker_version: run.rankerVersion,
      retrieval_stats: run.retrievalStats,
      latency_ms: run.latencyMs,
      created_at: run.createdAt,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
