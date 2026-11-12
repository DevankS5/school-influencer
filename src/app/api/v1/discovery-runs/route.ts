import { z } from "zod";
import { errorResponse, rateLimit, readJson } from "@/lib/http";
import { createRun, getRun, HttpError, listRecentRuns } from "@/lib/pipeline";
import type { ReferenceAnalysis } from "@/lib/types";

export const dynamic = "force-dynamic";

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

const createRunSchema = z.object({
  reference_profile_id: z.string().trim().max(60).nullish(),
  profile_text: z.string().trim().min(80, "Profile text should be at least 80 characters so claims can be tied to source text.").max(8000).nullish(),
  profile_url: z.string().trim().url().max(500).nullish(),
  display_name: z.string().trim().min(2).max(120).nullish(),
  current_role: optionalText(160),
  organisation: optionalText(160),
  location: optionalText(160),
  limit: z.number().int().min(1).max(100).default(30),
  filters: z
    .object({
      country: z.string().trim().max(60).nullish(),
      minimum_score: z.number().min(0).max(100).nullish(),
    })
    .default({}),
});

function summariseAnalysis(a: ReferenceAnalysis) {
  return {
    role_family: a.role_families,
    current_role: a.current_role,
    current_organisation: a.current_organisation,
    location: a.location,
    sector_tags: a.sector_tags,
    school_exposure: a.school_exposure,
    multi_school_exposure: a.multi_school_exposure,
    missing_fields: a.missing_fields,
    analysis_confidence: a.analysis_confidence,
  };
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "create-run", 12);
  if (limited) return limited;
  try {
    const body = createRunSchema.parse(await readJson(req));
    const paths = [body.reference_profile_id, body.profile_text, body.profile_url].filter(Boolean).length;
    if (paths !== 1) {
      throw new HttpError(422, "single_input_path_required", "Provide exactly one of reference_profile_id, profile_text or profile_url.");
    }
    if (body.profile_url) {
      throw new HttpError(
        422,
        "no_authorised_connector",
        "No authorised connector is configured for this URL, and the tool never scrapes LinkedIn or other sites. Paste the profile text you are permitted to use, or pick a seeded reference.",
      );
    }
    if (body.profile_text && !body.display_name) {
      throw new HttpError(422, "display_name_required", "A name or stable display label is required with pasted profile text.");
    }
    const runId = await createRun({
      referenceProfileId: body.reference_profile_id ?? undefined,
      profileText: body.profile_text ?? undefined,
      displayName: body.display_name ?? undefined,
      currentRole: body.current_role,
      organisation: body.organisation,
      location: body.location,
      limit: body.limit,
      minimumScore: body.filters.minimum_score ?? null,
      country: body.filters.country || null,
    });
    const run = await getRun(runId);
    return Response.json(
      {
        run_id: runId,
        status: run!.status,
        reference_analysis: summariseAnalysis(run!.analysis as unknown as ReferenceAnalysis),
        candidate_count: run!.candidateCount,
        relevant_count: run!.relevantCount,
        target_met: run!.relevantCount >= 20,
        dataset_version: run!.datasetVersion,
        ranker_version: run!.rankerVersion,
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET() {
  try {
    const runs = await listRecentRuns(10);
    return Response.json({
      runs: runs.map((r) => ({ run_id: r.id, reference: r.referenceLabel, status: r.status, candidate_count: r.candidateCount, relevant_count: r.relevantCount, created_at: r.createdAt })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
