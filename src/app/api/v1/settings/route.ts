import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { rankingConfigs } from "@/db/schema";
import { configSchema, getActiveConfig, listConfigs } from "@/lib/config";
import { errorResponse, rateLimit, readJson } from "@/lib/http";
import { HttpError } from "@/lib/pipeline";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

function authorise(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  if (token && req.headers.get("x-admin-token") !== token) {
    throw new HttpError(401, "unauthorised", "Valid administrator token required to change ranking configuration.");
  }
}

export async function GET() {
  try {
    await ensureSeeded();
    const [active, all] = await Promise.all([getActiveConfig(), listConfigs()]);
    return Response.json({
      active,
      token_required: !!process.env.ADMIN_TOKEN,
      versions: all.map((c) => ({ version: c.version, is_active: c.isActive, notes: c.notes, created_at: c.createdAt })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), config: configSchema, notes: z.string().max(300).optional(), activate: z.boolean().default(true) }),
  z.object({ action: z.literal("activate"), version: z.string().max(40) }),
]);

export async function POST(req: Request) {
  const limited = rateLimit(req, "settings", 10);
  if (limited) return limited;
  try {
    authorise(req);
    const body = bodySchema.parse(await readJson(req));
    await ensureSeeded();
    if (body.action === "activate") {
      const [row] = await db.select().from(rankingConfigs).where(eq(rankingConfigs.version, body.version)).limit(1);
      if (!row) throw new HttpError(404, "not_found", "No such configuration version.");
      await db.transaction(async (tx) => {
        await tx.update(rankingConfigs).set({ isActive: false });
        await tx.update(rankingConfigs).set({ isActive: true }).where(eq(rankingConfigs.version, body.version));
      });
      return Response.json({ ok: true, active_version: body.version });
    }
    const exists = await db.select({ id: rankingConfigs.id }).from(rankingConfigs).where(eq(rankingConfigs.version, body.config.version)).limit(1);
    if (exists.length) throw new HttpError(409, "version_exists", "That version label already exists. Configurations are immutable — choose a new version label.");
    await db.transaction(async (tx) => {
      if (body.activate) await tx.update(rankingConfigs).set({ isActive: false });
      await tx.insert(rankingConfigs).values({
        id: `cfg_${body.config.version}`,
        version: body.config.version,
        config: body.config as unknown as Record<string, unknown>,
        isActive: body.activate,
        notes: body.notes ?? null,
      });
    });
    return Response.json({ ok: true, active_version: body.activate ? body.config.version : (await getActiveConfig()).version }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
