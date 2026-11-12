import { errorResponse } from "@/lib/http";
import { getRun, getRunResults } from "@/lib/pipeline";
import { parseResultFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await ctx.params;
    const run = await getRun(runId);
    if (!run) return Response.json({ error: "not_found", message: "Run not found." }, { status: 404 });
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const filters = parseResultFilters(sp, Number((run.params as { minimum_score?: number }).minimum_score ?? 0));
    const limit = Math.min(100, Math.max(1, Number(sp.limit) || 20));
    const offset = Math.max(0, Number(sp.offset) || 0);
    const all = await getRunResults(runId, filters);
    const page = all.slice(offset, offset + limit);
    return Response.json({
      run_id: runId,
      total: all.length,
      limit,
      offset,
      results: page.map((r) => ({
        candidate_id: r.person.id,
        rank: r.rank,
        name: r.person.displayName,
        profile_url: r.person.profileUrl,
        current_title: r.person.currentTitle,
        current_organisation: r.person.currentOrganisation,
        role_status: r.person.roleStatus,
        location: r.person.location,
        score: r.score,
        score_components: r.components,
        explanation: r.explanation,
        evidence: r.evidence,
        sources: r.sources.map((s) => ({ id: s.id, name: s.sourceName, type: s.sourceType, url: s.sourceUrl, data_origin: s.dataOrigin, retrieved_at: s.retrievedAt })),
        last_verified_at: r.person.lastVerifiedAt,
        data_completeness: r.completeness,
        confidence: r.confidenceLabel,
        limitations: r.limitations,
        warnings: r.warnings,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
