export type RoleFamily =
  | "school_leadership"
  | "school_ownership_governance"
  | "education_consulting"
  | "school_network_operations"
  | "education_entrepreneurship"
  | "school_services"
  | "education_policy_advisory"
  | "k12_academic_leadership"
  | "other_education"
  | "unknown";

export type SchoolExposure =
  | "direct_single_school"
  | "multi_school"
  | "school_group"
  | "school_adjacent"
  | "unknown";

export type ClaimType =
  | "school_leadership"
  | "school_ownership"
  | "school_governance"
  | "school_group_role"
  | "multi_school_advisory"
  | "regional_network_role"
  | "programme_across_schools"
  | "product_across_schools"
  | "school_association_role"
  | "k12_policy_advisory"
  | "single_school_role"
  | "cross_school_activity"
  | "education_general"
  | "higher_education_only"
  | "non_education";

export type SourceType =
  | "official_organisation_page"
  | "conference_speaker_bio"
  | "association_directory"
  | "licensed_dataset_extract"
  | "user_supplied_profile";

export type EvidenceQuality = "high" | "medium" | "low";
export type RoleStatus = "current" | "former" | "unknown";

export interface EvidenceSpan {
  indicator: string;
  text: string;
  start: number;
  end: number;
}

export interface ReferenceAnalysis {
  analyzer_version: string;
  display_name: string;
  current_role: string | null;
  current_organisation: string | null;
  location: string | null;
  region: string | null;
  country: string | null;
  seniority_band: "executive" | "senior" | "mid" | "junior" | "unknown";
  career_summary: string | null;
  sector_tags: string[];
  school_ecosystem_roles: string[];
  role_families: RoleFamily[];
  school_exposure: SchoolExposure;
  multi_school_exposure: boolean;
  leadership_indicators: string[];
  influence_indicators: string[];
  evidence_spans: EvidenceSpan[];
  missing_fields: string[];
  analysis_confidence: number;
  normalised_text: string;
  query_terms: string[];
  reference_document: string;
  role_document: string;
}

export type FeatureKey =
  | "school_ecosystem_relevance"
  | "role_experience_similarity"
  | "multi_school_exposure"
  | "leadership_governance"
  | "semantic_similarity"
  | "network_connector_evidence"
  | "data_confidence";

export interface RankingConfig {
  version: string;
  weights: Record<FeatureKey, number>;
  retrieval: { lexical_top_k: number; vector_top_k: number; rrf_k: number };
  gate: { min_school_relevance: number; cap: number };
  bands: { high: number; strong: number; moderate: number };
  diversity: { enabled: boolean; lambda: number };
  results: { default_limit: number; maximum_limit: number; default_minimum_score: number };
}

export interface ScoreComponent {
  key: FeatureKey;
  label: string;
  short: string;
  weight: number;
  value: number | null; // 0..1, null = not observable (weight renormalised)
  contribution: number; // points contributed to the final 0..100 score
  note: string;
}

export interface ExplanationFactor {
  component: FeatureKey;
  text: string;
  evidenceIds: string[];
}

export interface CandidateEvidence {
  id: string;
  sourceId: string;
  claimType: ClaimType;
  claimText: string;
  excerpt: string;
  sourceLocator: string;
  confidence: number;
  reviewStatus: string;
}

export interface CandidateSource {
  id: string;
  sourceName: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  publisherOrOwner: string;
  accessMethod: string;
  permissionNotes: string;
  dataOrigin: string;
  retrievedAt: string;
  verificationStatus: string;
  notes: string | null;
}

export interface ScoredCandidate {
  personId: string;
  score: number;
  components: ScoreComponent[];
  explanation: string;
  factors: ExplanationFactor[];
  limitations: string[];
  warnings: string[];
  evidenceIds: string[];
  completeness: number;
  confidenceLabel: "High" | "Medium" | "Limited evidence";
  retrieval: { lexicalRank: number | null; vectorRank: number | null; rrf: number; cosine: number };
}
