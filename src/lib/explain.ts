import { persons } from "@/db/schema";
import { CLAIM_TYPES } from "./taxonomy";
import type { CandidateEvidence, CandidateSource, ExplanationFactor, FeatureKey, ScoreComponent } from "./types";

type Person = typeof persons.$inferSelect;

const EXPLAINABLE: FeatureKey[] = [
  "school_ecosystem_relevance",
  "multi_school_exposure",
  "leadership_governance",
  "network_connector_evidence",
];

function supportScore(key: FeatureKey, e: CandidateEvidence): number {
  const def = CLAIM_TYPES[e.claimType];
  if (!def) return 0;
  if (key === "school_ecosystem_relevance") return def.s;
  if (key === "multi_school_exposure") return def.multi ?? 0;
  if (key === "leadership_governance") return def.leadership ? (e.claimType === "regional_network_role" ? 0.75 : 1) : 0;
  if (key === "network_connector_evidence") return def.network ? 1 : 0;
  return 0;
}

const PHRASE: Record<string, string> = {
  school_ecosystem_relevance: "school-sector evidence",
  multi_school_exposure: "multi-school exposure",
  leadership_governance: "leadership / governance",
  network_connector_evidence: "documented ecosystem role",
};

/** Deterministic, evidence-grounded explanation. Every factor cites evidence ids and quotes the source excerpt. */
export function buildExplanation(args: {
  person: Person;
  evidence: CandidateEvidence[];
  sources: CandidateSource[];
  components: ScoreComponent[];
  completeness: number;
  asOf: Date;
  warnings: string[];
}) {
  const { person, evidence, sources, components, completeness, asOf } = args;
  const ranked = components
    .filter((c) => EXPLAINABLE.includes(c.key) && (c.value ?? 0) > 0)
    .sort((a, b) => b.contribution - a.contribution);

  const used = new Set<string>();
  const factors: ExplanationFactor[] = [];
  for (const comp of ranked) {
    if (factors.length >= 2) break;
    const best = evidence
      .filter((e) => !used.has(e.id) && supportScore(comp.key, e) > 0)
      .sort((a, b) => supportScore(comp.key, b) * b.confidence - supportScore(comp.key, a) * a.confidence || a.id.localeCompare(b.id))[0];
    if (!best) continue;
    used.add(best.id);
    factors.push({
      component: comp.key,
      text: `${CLAIM_TYPES[best.claimType].label}: “${best.excerpt}”`,
      evidenceIds: [best.id],
    });
  }

  const sValue = components.find((c) => c.key === "school_ecosystem_relevance")?.value ?? 0;
  let explanation: string;
  if (!factors.length || sValue < 0.25) {
    const first = evidence[0];
    explanation = first
      ? `No supported school-sector relevance in the source record (${CLAIM_TYPES[first.claimType].label.toLowerCase()}: “${first.excerpt}”), so the score is held down regardless of title.`
      : "No source-backed evidence of school-sector work.";
    if (first && !factors.length) factors.push({ component: "school_ecosystem_relevance", text: `${CLAIM_TYPES[first.claimType].label}: “${first.excerpt}”`, evidenceIds: [first.id] });
  } else {
    const names = factors.map((f) => PHRASE[f.component]).join(" and ");
    const former = person.roleStatus === "former" ? "Former role. " : "";
    explanation = `${former}Ranked on ${names}. Source-backed: ${factors.map((f) => f.text.split(": ").slice(1).join(": ")).join("; ")}.`;
  }

  // Validate: every factor must cite an existing evidence id and quote its excerpt.
  const ids = new Set(evidence.map((e) => e.id));
  const valid = factors.every((f) => f.evidenceIds.every((id) => ids.has(id)) && f.evidenceIds.every((id) => explanation.includes(evidence.find((e) => e.id === id)!.excerpt)));
  if (!valid) explanation = "Explanation withheld: could not be matched to source evidence. See evidence panel.";

  const limitations: string[] = [];
  if (person.lastVerifiedAt) {
    const months = (asOf.getTime() - person.lastVerifiedAt.getTime()) / (30.44 * 86400000);
    if (months > 12) limitations.push(`Last verified ${person.lastVerifiedAt.toISOString().slice(0, 10)} — more than 12 months before the dataset date; may be out of date.`);
  } else limitations.push("No verification date on record.");
  if (sources.length > 0 && sources.every((s) => s.sourceType === "conference_speaker_bio")) limitations.push("Event biography only — treated as historical evidence; current role not confirmed.");
  if (person.roleStatus === "former") limitations.push("Source describes a former role.");
  if (person.roleStatus === "unknown") limitations.push("Current/former status is not stated in the source.");
  if (person.schoolExposure === "unknown") limitations.push("Multi-school exposure is not documented.");
  if (sources.length === 1) limitations.push("Single source record; not cross-checked.");
  if (!person.location) limitations.push("Location not stated.");
  if (completeness < 0.6) limitations.push("Sparse record — limited evidence for a confident judgement.");
  if (sources.some((s) => s.dataOrigin === "synthetic")) limitations.push("Synthetic test record — fictional person, never a real discovery.");

  return { explanation, factors, limitations, evidenceIds: [...new Set([...used, ...factors.flatMap((f) => f.evidenceIds)])] };
}
