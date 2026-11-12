import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { importBatches, referenceProfiles } from "@/db/schema";
import { ACTIVE_DATASET_VERSION, ensureSeeded } from "./seed";

export async function getBatch() {
  await ensureSeeded();
  const [b] = await db.select().from(importBatches).where(eq(importBatches.datasetVersion, ACTIVE_DATASET_VERSION)).limit(1);
  return b;
}

export async function getReferences() {
  await ensureSeeded();
  return db.select().from(referenceProfiles).orderBy(asc(referenceProfiles.sortOrder));
}

export async function getReference(id: string) {
  await ensureSeeded();
  const [r] = await db.select().from(referenceProfiles).where(eq(referenceProfiles.id, id)).limit(1);
  return r ?? null;
}
