import type { ClaimType, FeatureKey, RoleFamily, SchoolExposure, SourceType } from "./types";

export const TAXONOMY_VERSION = "edxso-taxonomy-v1";

export const ROLE_FAMILIES: Record<RoleFamily, string> = {
  school_leadership: "School leadership",
  school_ownership_governance: "Ownership & governance",
  education_consulting: "Education consulting",
  school_network_operations: "School network operations",
  education_entrepreneurship: "Education entrepreneurship",
  school_services: "School services",
  education_policy_advisory: "Policy & advisory",
  k12_academic_leadership: "K-12 academic leadership",
  other_education: "Other education",
  unknown: "Unclassified",
};

export const SCHOOL_EXPOSURE: Record<SchoolExposure, string> = {
  direct_single_school: "Single school",
  multi_school: "Multi-school",
  school_group: "School group",
  school_adjacent: "School-adjacent",
  unknown: "Unknown",
};

export const SOURCE_TYPES: Record<SourceType, string> = {
  official_organisation_page: "Official organisation page",
  conference_speaker_bio: "Conference speaker bio",
  association_directory: "Association directory",
  licensed_dataset_extract: "Licensed dataset extract",
  user_supplied_profile: "User-supplied profile",
};

/**
 * Claim types: S = school-ecosystem relevance rubric value (doc 03 §5.1),
 * `supports` = which score components the claim can evidence.
 */
export const CLAIM_TYPES: Record<
  ClaimType,
  { label: string; s: number; supports: FeatureKey[]; multi?: number; network?: boolean; leadership?: boolean }
> = {
  school_leadership: { label: "School leadership", s: 1, supports: ["school_ecosystem_relevance", "leadership_governance"], leadership: true },
  school_ownership: { label: "School ownership", s: 1, supports: ["school_ecosystem_relevance", "leadership_governance"], leadership: true },
  school_governance: { label: "School governance", s: 1, supports: ["school_ecosystem_relevance", "leadership_governance", "network_connector_evidence"], leadership: true, network: true },
  school_group_role: { label: "School group role", s: 1, supports: ["school_ecosystem_relevance", "multi_school_exposure", "leadership_governance", "network_connector_evidence"], multi: 1, leadership: true, network: true },
  multi_school_advisory: { label: "Multi-school advisory", s: 1, supports: ["school_ecosystem_relevance", "multi_school_exposure", "network_connector_evidence"], multi: 1, network: true },
  regional_network_role: { label: "Regional network role", s: 0.85, supports: ["school_ecosystem_relevance", "multi_school_exposure", "leadership_governance", "network_connector_evidence"], multi: 0.7, leadership: true, network: true },
  programme_across_schools: { label: "Programme across schools", s: 0.75, supports: ["school_ecosystem_relevance", "multi_school_exposure", "network_connector_evidence"], multi: 0.7, network: true },
  product_across_schools: { label: "Product deployed across schools", s: 0.75, supports: ["school_ecosystem_relevance", "multi_school_exposure", "network_connector_evidence"], multi: 0.7, network: true },
  school_association_role: { label: "School association role", s: 0.75, supports: ["school_ecosystem_relevance", "network_connector_evidence"], network: true },
  k12_policy_advisory: { label: "K-12 policy advisory", s: 0.75, supports: ["school_ecosystem_relevance", "network_connector_evidence"], network: true },
  single_school_role: { label: "Single-school role", s: 0.5, supports: ["school_ecosystem_relevance"] },
  cross_school_activity: { label: "Cross-school activity", s: 0.5, supports: ["school_ecosystem_relevance", "multi_school_exposure"], multi: 0.4 },
  education_general: { label: "General education", s: 0.25, supports: ["school_ecosystem_relevance"] },
  higher_education_only: { label: "Higher education only", s: 0.1, supports: [] },
  non_education: { label: "Non-education role", s: 0, supports: [] },
};

export const FEATURES: { key: FeatureKey; label: string; short: string; blurb: string }[] = [
  { key: "school_ecosystem_relevance", label: "School ecosystem relevance", short: "School", blurb: "Direct evidence of school-sector work" },
  { key: "role_experience_similarity", label: "Role & experience similarity", short: "Role", blurb: "Role-family overlap and responsibility similarity to the reference" },
  { key: "multi_school_exposure", label: "Multi-school exposure", short: "Multi-school", blurb: "Documented work across several schools or a group" },
  { key: "leadership_governance", label: "Leadership & governance", short: "Leadership", blurb: "Principal, owner, trustee, director or senior leadership" },
  { key: "semantic_similarity", label: "Semantic similarity", short: "Semantic", blurb: "Embedding similarity of professional context (pool-calibrated)" },
  { key: "network_connector_evidence", label: "Network / connector evidence", short: "Network", blurb: "Documented cross-organisation or ecosystem role" },
  { key: "data_confidence", label: "Data confidence", short: "Confidence", blurb: "Source quality, freshness and completeness" },
];

/** Family-to-family partial credit used by the role similarity feature. */
export const FAMILY_ADJACENCY: [RoleFamily, RoleFamily, number][] = [
  ["school_leadership", "school_ownership_governance", 0.6],
  ["school_leadership", "k12_academic_leadership", 0.7],
  ["school_leadership", "education_consulting", 0.5],
  ["school_leadership", "school_network_operations", 0.6],
  ["school_ownership_governance", "school_network_operations", 0.7],
  ["education_consulting", "education_policy_advisory", 0.6],
  ["education_consulting", "k12_academic_leadership", 0.5],
  ["education_consulting", "school_services", 0.5],
  ["education_entrepreneurship", "school_services", 0.7],
  ["education_entrepreneurship", "education_consulting", 0.4],
  ["k12_academic_leadership", "school_network_operations", 0.5],
  ["school_ownership_governance", "education_entrepreneurship", 0.4],
  ["school_ownership_governance", "education_consulting", 0.4],
];

export function familySimilarity(a: RoleFamily, b: RoleFamily): number {
  if (a === b) return a === "unknown" ? 0 : a === "other_education" ? 0.3 : 1;
  const hit = FAMILY_ADJACENCY.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (hit) return hit[2];
  if (a === "other_education" || b === "other_education") return 0.1;
  return 0;
}

/** Synonym groups: used to expand recall (lexical) and to build concept tokens (embedding). */
export const SYNONYM_GROUPS: { id: string; phrases: string[] }[] = [
  { id: "principal", phrases: ["principal", "head of school", "school head", "headmaster", "headmistress", "head teacher"] },
  { id: "trustee", phrases: ["trustee", "governing board member", "school governor", "board member", "chairperson", "society member"] },
  { id: "owner", phrases: ["school owner", "promoter", "education group founder", "owner", "proprietor", "founder trustee"] },
  { id: "advisor", phrases: ["education advisor", "education adviser", "school consultant", "academic consultant", "academic advisor", "school improvement partner", "education consultant", "advisor", "adviser"] },
  { id: "network", phrases: ["school chain", "school group", "network of schools", "group of schools", "school network", "education trust", "learning trust"] },
  { id: "director", phrases: ["director", "regional director", "academic director", "head of operations", "vice president", "chief executive", "ceo"] },
  { id: "k12", phrases: ["k-12", "k12", "school education", "cbse", "icse", "ib schools", "cambridge", "state board", "schools"] },
  { id: "highered", phrases: ["university", "professor", "college", "faculty", "campus", "phd"] },
  { id: "edtech", phrases: ["edtech", "platform", "software", "erp", "app"] },
  { id: "training", phrases: ["teacher training", "professional development", "coaching", "mentoring", "fellowship", "capacity building"] },
  { id: "governance", phrases: ["governance", "governing board", "board", "accreditation", "quality assurance", "audit"] },
  { id: "corporate", phrases: ["manufacturing", "fmcg", "retail", "fintech", "banking", "venture capital", "real estate", "logistics"] },
];

export const STOPWORDS = new Set(
  "a an and are as at be by for from has have in is it its of on or that the their this to was were with who which he she they his her we our also into than then these those".split(" "),
);

/** Words so common in this domain that they should not dominate similarity. */
export const DOMAIN_COMMON = new Set(["school", "schools", "education", "educational", "india", "indian", "year", "years"]);

export const INDIA_GAZETTEER: Record<string, { region: string; country: string }> = {
  gurugram: { region: "Delhi NCR", country: "India" },
  gurgaon: { region: "Delhi NCR", country: "India" },
  delhi: { region: "Delhi NCR", country: "India" },
  noida: { region: "Delhi NCR", country: "India" },
  "new delhi": { region: "Delhi NCR", country: "India" },
  mumbai: { region: "Maharashtra", country: "India" },
  pune: { region: "Maharashtra", country: "India" },
  nagpur: { region: "Maharashtra", country: "India" },
  bengaluru: { region: "Karnataka", country: "India" },
  bangalore: { region: "Karnataka", country: "India" },
  mysuru: { region: "Karnataka", country: "India" },
  chennai: { region: "Tamil Nadu", country: "India" },
  coimbatore: { region: "Tamil Nadu", country: "India" },
  hyderabad: { region: "Telangana", country: "India" },
  kolkata: { region: "West Bengal", country: "India" },
  ahmedabad: { region: "Gujarat", country: "India" },
  surat: { region: "Gujarat", country: "India" },
  jaipur: { region: "Rajasthan", country: "India" },
  kochi: { region: "Kerala", country: "India" },
  thiruvananthapuram: { region: "Kerala", country: "India" },
  lucknow: { region: "Uttar Pradesh", country: "India" },
  ludhiana: { region: "Punjab", country: "India" },
  chandigarh: { region: "Punjab", country: "India" },
  indore: { region: "Madhya Pradesh", country: "India" },
  bhopal: { region: "Madhya Pradesh", country: "India" },
  guwahati: { region: "Assam", country: "India" },
  bhubaneswar: { region: "Odisha", country: "India" },
  dehradun: { region: "Uttarakhand", country: "India" },
  vijayawada: { region: "Andhra Pradesh", country: "India" },
  dubai: { region: "Dubai", country: "UAE" },
  singapore: { region: "Singapore", country: "Singapore" },
};

export const LEADERSHIP_KEYWORDS: { re: RegExp; score: number; label: string }[] = [
  { re: /\b(owner|proprietor|promoter|trustee|chairperson|chairman|chair|founder|ceo|chief executive|managing director|president)\b/i, score: 1, label: "Owner / trustee / chief executive" },
  { re: /\b(principal|head of school|headmaster|headmistress|school director|director of schools|academic director)\b/i, score: 1, label: "Principal / head / director" },
  { re: /\b(regional director|vice president|vp|group director|director)\b/i, score: 0.75, label: "Senior network / regional director" },
  { re: /\b(head|lead|senior advisor|senior consultant|advisor|adviser|consultant|coach|mentor)\b/i, score: 0.5, label: "Senior advisory / lead" },
  { re: /\b(manager|coordinator|programme|program|officer|associate)\b/i, score: 0.25, label: "Manager / coordinator" },
];
