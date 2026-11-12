import { toCsv } from "@/lib/csv";
import { parseResultFilters } from "@/lib/filters";
import { errorResponse, rateLimit } from "@/lib/http";
import { getRun, getRunResults } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/** CSV of the currently displayed, source-attributed results (formula-injection safe). */
export async function GET(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const limited = rateLimit(req, "export", 20);
  if (limited) return limited;
  try {
    const { runId } = await ctx.params;
    const run = await getRun(runId);
    if (!run) return Response.json({ error: "not_found", message: "Run not found." }, { status: 404 });
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const rows = await getRunResults(runId, parseResultFilters(sp, Number((run.params as { minimum_score?: number }).minimum_score ?? 0)));
    const synthetic = rows.some((r) => r.sources.some((s) => s.dataOrigin === "synthetic"));
    const csv = toCsv(
      ["Rank", "Name", "Current role", "Organisation", "Location", "Profile URL", "Score", "Match band", "Explanation", "Source references", "Last verified", "Data origin"],
      rows.map((r, i) => [
        i + 1,
        r.person.displayName,
        r.person.currentTitle,
        r.person.currentOrganisation,
        r.person.location,
        r.person.profileUrl ?? "",
        r.score.toFixed(1),
        r.score >= 80 ? "High" : r.score >= 65 ? "Strong" : r.score >= 45 ? "Moderate" : "Weak",
        r.explanation,
        r.sources.map((s) => `${s.sourceName} [${s.id}]`).join("; "),
        r.person.lastVerifiedAt ? r.person.lastVerifiedAt.toISOString().slice(0, 10) : "",
        synthetic ? "SYNTHETIC TEST DATA" : "see source",
      ]),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="edxso-${runId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
