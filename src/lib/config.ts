import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { rankingConfigs } from "@/db/schema";
import type { FeatureKey, RankingConfig } from "./types";

export const FEATURE_KEYS: FeatureKey[] = [
  "school_ecosystem_relevance",
  "role_experience_similarity",
  "multi_school_exposure",
  "leadership_governance",
  "semantic_similarity",
  "network_connector_evidence",
  "data_confidence",
];

export const DEFAULT_CONFIG: RankingConfig = {
  version: "hybrid-v1",
  weights: {
    school_ecosystem_relevance: 0.3,
    role_experience_similarity: 0.2,
    multi_school_exposure: 0.15,
    leadership_governance: 0.15,
    semantic_similarity: 0.1,
    network_connector_evidence: 0.05,
    data_confidence: 0.05,
  },
  retrieval: { lexical_top_k: 50, vector_top_k: 50, rrf_k: 60 },
  gate: { min_school_relevance: 0.25, cap: 40 },
  bands: { high: 80, strong: 65, moderate: 45 },
  diversity: { enabled: false, lambda: 0.8 },
  results: { default_limit: 30, maximum_limit: 100, default_minimum_score: 45 },
};

const weightSchema = z.object(
  Object.fromEntries(FEATURE_KEYS.map((k) => [k, z.number().min(0).max(1)])) as Record<FeatureKey, z.ZodNumber>,
);

export const configSchema = z
  .object({
    version: z.string().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/),
    weights: weightSchema,
    retrieval: z.object({
      lexical_top_k: z.number().int().min(5).max(200),
      vector_top_k: z.number().int().min(5).max(200),
      rrf_k: z.number().int().min(1).max(200),
    }),
    gate: z.object({ min_school_relevance: z.number().min(0).max(1), cap: z.number().min(0).max(100) }),
    bands: z.object({ high: z.number(), strong: z.number(), moderate: z.number() }),
    diversity: z.object({ enabled: z.boolean(), lambda: z.number().min(0.5).max(1) }),
    results: z.object({
      default_limit: z.number().int().min(1).max(100),
      maximum_limit: z.number().int().min(1).max(200),
      default_minimum_score: z.number().min(0).max(100),
    }),
  })
  .refine((c) => Math.abs(Object.values(c.weights).reduce((a, b) => a + b, 0) - 1) < 1e-6, {
    message: "Weights must sum to 1.0",
    path: ["weights"],
  })
  .refine((c) => c.bands.high > c.bands.strong && c.bands.strong > c.bands.moderate, {
    message: "Bands must be descending: high > strong > moderate",
    path: ["bands"],
  });

export async function getActiveConfig(): Promise<RankingConfig> {
  const rows = await db.select().from(rankingConfigs).where(eq(rankingConfigs.isActive, true)).limit(1);
  if (rows[0]) {
    const parsed = configSchema.safeParse(rows[0].config);
    if (parsed.success) return parsed.data as RankingConfig;
  }
  return DEFAULT_CONFIG;
}

export async function listConfigs() {
  return db.select().from(rankingConfigs).orderBy(desc(rankingConfigs.createdAt));
}
