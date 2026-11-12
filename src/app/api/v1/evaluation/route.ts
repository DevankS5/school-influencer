import { evaluate } from "@/lib/evaluation";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await evaluate());
  } catch (e) {
    return errorResponse(e);
  }
}
