import { ZodError } from "zod";
import { HttpError } from "./pipeline";

const buckets = new Map<string, number[]>();

/** Small in-memory sliding-window limiter. Replace with a shared store when scaling out. */
export function rateLimit(req: Request, name: string, max: number, windowMs = 60_000): Response | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${name}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    return Response.json({ error: "rate_limited", message: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } });
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return null;
}

export async function readJson(req: Request, maxBytes = 40_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "payload_too_large", "Request body is too large.");
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON.");
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    return Response.json({ error: "validation_error", message: "Invalid request.", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  console.error("[api] unhandled error category=internal");
  return Response.json({ error: "internal_error", message: "Something went wrong." }, { status: 500 });
}
