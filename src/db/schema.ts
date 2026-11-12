import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** One row per dataset version imported. Holds licence notes + quality report. */
export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(),
  datasetVersion: text("dataset_version").notNull().unique(),
  dataOrigin: text("data_origin").notNull(), // synthetic | licensed | user_supplied
  title: text("title").notNull(),
  description: text("description").notNull(),
  licenceNotes: text("licence_notes").notNull(),
  asOf: ts("as_of").notNull(),
  stats: jsonb("stats").notNull().$type<Record<string, number>>(),
  qualityReport: jsonb("quality_report").notNull().$type<Record<string, unknown>>(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Canonical person records (post entity-resolution). */
export const persons = pgTable(
  "persons",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull(),
    displayName: text("display_name").notNull(),
    currentTitle: text("current_title"),
    currentOrganisation: text("current_organisation"),
    location: text("location"),
    region: text("region"),
    country: text("country"),
    profileUrl: text("profile_url"),
    biography: text("biography"),
    careerHistory: jsonb("career_history")
      .notNull()
      .$type<{ role: string; organisation: string; period: string | null }[]>()
      .default(sql`'[]'::jsonb`),
    sectorTags: text("sector_tags").array().notNull().default(sql`'{}'::text[]`),
    schoolRoles: text("school_roles").array().notNull().default(sql`'{}'::text[]`),
    roleFamilies: text("role_families").array().notNull().default(sql`'{}'::text[]`),
    schoolExposure: text("school_exposure").notNull().default("unknown"),
    roleStatus: text("role_status").notNull().default("unknown"),
    evidenceQuality: text("evidence_quality").notNull().default("low"),
    lastVerifiedAt: ts("last_verified_at"),
    searchDoc: text("search_doc").notNull(),
    resolution: jsonb("resolution").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("persons_batch_idx").on(t.batchId),
    index("persons_region_idx").on(t.region),
    index("persons_fts_idx").using("gin", sql`to_tsvector('english', ${t.searchDoc})`),
  ],
);

/** Source-specific records. Stay independently inspectable after merging. */
export const profileSources = pgTable(
  "profile_sources",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull(),
    sourceName: text("source_name").notNull(),
    sourceType: text("source_type").notNull(),
    sourceUrl: text("source_url"),
    publisherOrOwner: text("publisher_or_owner").notNull(),
    accessMethod: text("access_method").notNull(),
    permissionNotes: text("permission_notes").notNull(),
    dataOrigin: text("data_origin").notNull(),
    retrievedAt: ts("retrieved_at").notNull(),
    publishedAt: ts("published_at"),
    contentHash: text("content_hash").notNull(),
    fieldCoverage: text("field_coverage").array().notNull().default(sql`'{}'::text[]`),
    verificationStatus: text("verification_status").notNull(),
    notes: text("notes"),
  },
  (t) => [index("sources_person_idx").on(t.personId)],
);

/** Source-backed statements. Excerpts are literal spans from the source text. */
export const evidenceItems = pgTable(
  "evidence_items",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull(),
    sourceId: text("source_id").notNull(),
    claimType: text("claim_type").notNull(),
    claimText: text("claim_text").notNull(),
    excerpt: text("excerpt").notNull(),
    sourceLocator: text("source_locator").notNull(),
    observedAt: ts("observed_at").notNull(),
    confidence: real("confidence").notNull(),
    reviewStatus: text("review_status").notNull().default("unreviewed"),
  },
  (t) => [index("evidence_person_idx").on(t.personId)],
);

/** Versioned embedding vectors. Stored as float arrays (pgvector optional later). */
export const profileEmbeddings = pgTable(
  "profile_embeddings",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull(),
    modelName: text("model_name").notNull(),
    modelRevision: text("model_revision").notNull(),
    templateVersion: text("template_version").notNull(),
    dimension: integer("dimension").notNull(),
    embedding: real("embedding").array().notNull(),
    roleEmbedding: real("role_embedding").array().notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("embeddings_person_model_idx").on(t.personId, t.modelName)],
);

/** Seeded reference profiles (the demo test references). */
export const referenceProfiles = pgTable("reference_profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  currentRole: text("current_role"),
  organisation: text("organisation"),
  location: text("location"),
  profileText: text("profile_text").notNull(),
  headline: text("headline").notNull(),
  isSynthetic: boolean("is_synthetic").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const profileAnalyses = pgTable(
  "profile_analyses",
  {
    id: text("id").primaryKey(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    analysisJson: jsonb("analysis_json").notNull().$type<Record<string, unknown>>(),
    analyzerVersion: text("analyzer_version").notNull(),
    modelName: text("model_name").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("analyses_subject_idx").on(t.subjectType, t.subjectId)],
);

export const rankingConfigs = pgTable("ranking_configs", {
  id: text("id").primaryKey(),
  version: text("version").notNull().unique(),
  config: jsonb("config").notNull().$type<Record<string, unknown>>(),
  isActive: boolean("is_active").notNull().default(false),
  notes: text("notes"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull(),
    referenceKind: text("reference_kind").notNull(), // seeded | pasted
    referenceId: text("reference_id"),
    referenceLabel: text("reference_label").notNull(),
    analysis: jsonb("analysis").notNull().$type<Record<string, unknown>>(),
    params: jsonb("params").notNull().$type<Record<string, unknown>>(),
    datasetVersion: text("dataset_version").notNull(),
    rankerVersion: text("ranker_version").notNull(),
    configSnapshot: jsonb("config_snapshot").notNull().$type<Record<string, unknown>>(),
    retrievalStats: jsonb("retrieval_stats").notNull().$type<Record<string, unknown>>(),
    candidateCount: integer("candidate_count").notNull().default(0),
    relevantCount: integer("relevant_count").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("runs_created_idx").on(t.createdAt)],
);

export const discoveryResults = pgTable(
  "discovery_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    personId: text("person_id").notNull(),
    rank: integer("rank").notNull(),
    score: real("score").notNull(),
    components: jsonb("components").notNull().$type<unknown[]>(),
    explanation: text("explanation").notNull(),
    factors: jsonb("factors").notNull().$type<unknown[]>(),
    limitations: jsonb("limitations").notNull().$type<string[]>(),
    evidenceIds: text("evidence_ids").array().notNull().default(sql`'{}'::text[]`),
    retrieval: jsonb("retrieval").notNull().$type<Record<string, unknown>>(),
    completeness: real("completeness").notNull(),
    confidenceLabel: text("confidence_label").notNull(),
    warnings: jsonb("warnings").notNull().$type<string[]>(),
  },
  (t) => [index("results_run_idx").on(t.runId, t.rank)],
);

/** Graded human-style relevance labels used by the evaluation harness. */
export const relevanceLabels = pgTable(
  "relevance_labels",
  {
    id: text("id").primaryKey(),
    referenceId: text("reference_id").notNull(),
    personId: text("person_id").notNull(),
    grade: integer("grade").notNull(),
    split: text("split").notNull(), // train | heldout
    annotator: text("annotator").notNull(),
    rationale: text("rationale"),
  },
  (t) => [index("labels_ref_idx").on(t.referenceId)],
);

/** Correction / removal workflow (privacy requirement). */
export const correctionRequests = pgTable("correction_requests", {
  id: text("id").primaryKey(),
  personId: text("person_id"),
  requestType: text("request_type").notNull(),
  contact: text("contact").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: ts("created_at").notNull().defaultNow(),
});
