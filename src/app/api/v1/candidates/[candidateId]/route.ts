import { errorResponse } from "@/lib/http";
import { getCandidate } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await ctx.params;
    const c = await getCandidate(candidateId);
    if (!c) return Response.json({ error: "not_found", message: "Candidate not found." }, { status: 404 });
    const p = c.person;
    return Response.json({
      candidate_id: p.id,
      name: p.displayName,
      profile_url: p.profileUrl,
      current_title: p.currentTitle,
      current_organisation: p.currentOrganisation,
      role_status: p.roleStatus,
      location: p.location,
      country: p.country,
      biography: p.biography,
      career_history: p.careerHistory,
      sector_tags: p.sectorTags,
      school_roles: p.schoolRoles,
      role_families: p.roleFamilies,
      school_exposure: p.schoolExposure,
      evidence_quality: p.evidenceQuality,
      last_verified_at: p.lastVerifiedAt,
      resolution: p.resolution,
      evidence: c.evidence,
      sources: c.sources,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
