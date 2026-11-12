import { z } from "zod";
import { db } from "@/db";
import { correctionRequests } from "@/db/schema";
import { errorResponse, rateLimit, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  person_id: z.string().trim().max(60).nullish(),
  request_type: z.enum(["correction", "removal"]),
  contact: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(1500),
});

/** Correction / removal workflow. Requests are queued for a human reviewer. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "corrections", 5);
  if (limited) return limited;
  try {
    const body = schema.parse(await readJson(req, 8000));
    const id = `corr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await db.insert(correctionRequests).values({
      id,
      personId: body.person_id || null,
      requestType: body.request_type,
      contact: body.contact,
      message: body.message,
    });
    return Response.json({ ok: true, request_id: id, status: "open" }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
