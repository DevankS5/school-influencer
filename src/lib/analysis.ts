import { INDIA_GAZETTEER, LEADERSHIP_KEYWORDS, ROLE_FAMILIES } from "./taxonomy";
import { expandSynonyms, normaliseWhitespace } from "./text";
import type { EvidenceSpan, ReferenceAnalysis, RoleFamily, SchoolExposure } from "./types";

export const ANALYZER_VERSION = "rules-analyzer-v1";

export interface ReferenceInput {
  displayName: string;
  profileText: string;
  currentRole?: string | null;
  organisation?: string | null;
  location?: string | null;
}

interface Rule {
  re: RegExp;
  label: string;
}

const ROLE_RULES: (Rule & { families: RoleFamily[] })[] = [
  { re: /\bprincipal\b/gi, label: "principal", families: ["school_leadership"] },
  { re: /\bhead of school\b|\bheadmaster\b|\bheadmistress\b/gi, label: "head of school", families: ["school_leadership"] },
  { re: /\btrustee\b|\bgoverning board\b|\bboard member\b|\bchairperson\b/gi, label: "trustee", families: ["school_ownership_governance"] },
  { re: /\bschool owner\b|\bpromoter\b|\bproprietor\b|\bfounder trustee\b/gi, label: "school owner", families: ["school_ownership_governance"] },
  { re: /\b(?:academic|education|school|curriculum|leadership)\s+(?:advisor|adviser|consultant)\b|\bschool improvement partner\b|\badvises\b|\badvisory\b/gi, label: "advisor", families: ["education_consulting"] },
  { re: /\bregional director\b|\bgroup ceo\b|\bchief executive\b|\bschool group\b|\bnetwork of schools\b|\bschool network\b|\blearning trust\b/gi, label: "network leader", families: ["school_network_operations"] },
  { re: /\bacademic director\b|\bdirector of (?:curriculum|academics)\b|\bhead of academics\b/gi, label: "academic director", families: ["k12_academic_leadership"] },
  { re: /\bfounder\b|\bco-founder\b/gi, label: "founder", families: ["education_entrepreneurship"] },
  { re: /\bpolicy\b|\bcurriculum council\b|\bboard of education\b/gi, label: "policy advisor", families: ["education_policy_advisory"] },
];

const SECTOR_RULES: Rule[] = [
  { re: /\bk-?12\b|\bschool education\b/gi, label: "K-12" },
  { re: /\bCBSE\b/g, label: "CBSE" },
  { re: /\bICSE\b|\bISC\b/g, label: "ICSE" },
  { re: /\bIB\b|\bInternational Baccalaureate\b/g, label: "IB" },
  { re: /\bgovernance\b|\bgoverning board\b|\btrustees?\b/gi, label: "school_governance" },
  { re: /\bteacher (?:training|development)\b|\bprofessional development\b/gi, label: "teacher_development" },
  { re: /\bcurriculum\b/gi, label: "curriculum" },
  { re: /\bedtech\b|\bplatform\b|\bsoftware\b/gi, label: "edtech" },
  { re: /\buniversity\b|\bprofessor\b|\bhigher education\b/gi, label: "higher_education" },
];

const MULTI_RE =
  /\b(\d+\+?|several|multiple|dozens? of|hundreds? of|a portfolio of)\s+(?:[A-Za-z-]+\s+){0,3}schools\b/gi;
const GROUP_RE = /\bschool (?:group|chain|network)\b|\bnetwork of schools\b|\bgroup of schools\b|\blearning trust\b/gi;
const ADJACENT_RE = /\b(?:platform|software|programme|program|curriculum|training|fellowship)\b[^.]{0,80}\bschools\b/gi;
const FORMER_RE = /\b(?:former|formerly|previously|was|served as|until \d{4}|retired)\b/i;

function findAll(text: string, re: RegExp): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) r.lastIndex++;
  }
  return out;
}

function seniority(role: string | null): ReferenceAnalysis["seniority_band"] {
  if (!role) return "unknown";
  if (/\b(founder|co-founder|ceo|chair|owner|president|managing director|chief)\b/i.test(role)) return "executive";
  if (/\b(principal|director|head|vice president|vp|advisor|adviser|partner)\b/i.test(role)) return "senior";
  if (/\b(manager|lead|coordinator|officer)\b/i.test(role)) return "mid";
  if (/\b(teacher|associate|assistant|intern)\b/i.test(role)) return "junior";
  return "unknown";
}

function locate(location: string | null, text: string): { region: string | null; country: string | null; location: string | null } {
  const hay = `${location ?? ""} ${text}`.toLowerCase();
  const sorted = Object.keys(INDIA_GAZETTEER).sort((a, b) => b.length - a.length);
  const city = sorted.find((c) => new RegExp(`\\b${c}\\b`).test(hay));
  if (!city) return { region: null, country: null, location };
  const g = INDIA_GAZETTEER[city];
  return { region: g.region, country: g.country, location: location ?? city.replace(/\b\w/g, (c) => c.toUpperCase()) };
}

/** Deterministic, evidence-span-backed analysis. Unknown fields stay null / listed in missing_fields. */
export function analyseReference(input: ReferenceInput): ReferenceAnalysis {
  const text = normaliseWhitespace(input.profileText);
  const spans: EvidenceSpan[] = [];
  const addSpan = (indicator: string, m: { text: string; start: number; end: number }) => {
    if (!spans.some((s) => s.indicator === indicator && s.start === m.start)) {
      // widen to give readable context (up to ~70 chars each side, bounded by sentence)
      const dotBefore = text.lastIndexOf(". ", m.start);
      const from = dotBefore >= 0 ? dotBefore + 2 : 0;
      const toDot = text.indexOf(". ", m.end);
      const to = toDot === -1 ? text.length : toDot + 1;
      const start = from;
      let end = to;
      if (end - start > 260) {
        const cut = text.lastIndexOf(" ", start + 260);
        end = cut > m.end ? cut : Math.max(m.end, start + 260);
      }
      spans.push({ indicator, text: text.slice(start, end), start, end });
    }
  };

  // --- roles & families
  const roles = new Set<string>();
  const families = new Set<RoleFamily>();
  for (const rule of ROLE_RULES) {
    const hits = findAll(text, rule.re);
    if (hits.length) {
      roles.add(rule.label);
      rule.families.forEach((f) => families.add(f));
      addSpan(`role:${rule.label}`, hits[0]);
    }
  }

  // --- exposure
  let exposure: SchoolExposure = "unknown";
  const multi = findAll(text, MULTI_RE);
  const group = findAll(text, GROUP_RE);
  const adjacent = findAll(text, ADJACENT_RE);
  if (multi.length) {
    exposure = "multi_school";
    addSpan("exposure:multi_school", multi[0]);
  } else if (group.length) {
    exposure = "school_group";
    addSpan("exposure:school_group", group[0]);
  } else if (adjacent.length) {
    exposure = "school_adjacent";
    addSpan("exposure:school_adjacent", adjacent[0]);
  } else if (roles.has("principal") || roles.has("head of school")) {
    exposure = "direct_single_school";
  }
  if (group.length && exposure === "multi_school") addSpan("exposure:school_group", group[0]);

  // --- sector tags
  const sectorTags: string[] = [];
  for (const rule of SECTOR_RULES) {
    const hits = findAll(text, rule.re);
    if (hits.length) {
      sectorTags.push(rule.label);
      addSpan(`sector:${rule.label}`, hits[0]);
    }
  }
  if (/k-?12|schools?\b/i.test(text) && !sectorTags.includes("K-12")) sectorTags.unshift("K-12");

  // --- structured fields: use supplied, else conservative extraction
  let currentRole = input.currentRole?.trim() || null;
  let organisation = input.organisation?.trim() || null;
  if (!currentRole || !organisation) {
    const m = text.match(
      /\b(?:is|serves as|works as)\s+(?:the\s+|a\s+|an\s+)?([A-Z][A-Za-z&-]*(?:\s+(?:of|and|&|for)\s+[A-Z][A-Za-z&-]*|\s+[A-Z][A-Za-z&-]*){0,5}?)\s+at\s+((?:[A-Z][\w&'-]*\s?){1,6})/,
    );
    if (m) {
      currentRole = currentRole ?? m[1].trim();
      organisation = organisation ?? m[2].trim().replace(/[.,]$/, "");
    }
  }
  const loc = locate(input.location?.trim() || null, text);

  // --- leadership & influence indicators (evidence-backed only)
  const leadership: string[] = [];
  for (const k of LEADERSHIP_KEYWORDS.slice(0, 3)) {
    const hits = findAll(`${currentRole ?? ""}. ${text}`, k.re);
    if (hits.length) {
      leadership.push(k.label);
      const inText = findAll(text, k.re);
      if (inText.length) addSpan(`leadership:${k.label}`, inText[0]);
    }
  }
  const influence: string[] = [];
  if (/\bfounder\b|\bowner\b|\btrustee\b|\bchair/i.test(text)) influence.push("Founder / owner or board / trustee role");
  if (/\bprincipal\b|\bhead of school\b|\bdirector\b/i.test(text)) influence.push("Principal / head / director role");
  if (exposure === "multi_school" || exposure === "school_group") influence.push("Documented advisory or operating responsibility across institutions");
  if (/\bspeak|\bkeynote|\bassociation\b|\bpanel/i.test(text)) influence.push("Publicly documented speaking or association activity");

  // --- career summary: first two sentences, verbatim
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const careerSummary = sentences.length ? sentences.slice(0, 2).join(" ") : null;

  const roleFamilies: RoleFamily[] = families.size ? [...families] : ["unknown"];
  // org-level role from supplied title reinforces family
  if (currentRole && /advis|consult/i.test(currentRole)) roleFamilies.includes("education_consulting") || roleFamilies.push("education_consulting");
  const filteredFamilies = roleFamilies.filter((f, i, a) => a.indexOf(f) === i && (f !== "unknown" || a.length === 1));

  const missing: string[] = [];
  if (!currentRole) missing.push("current_role");
  if (!organisation) missing.push("current_organisation");
  if (!loc.location) missing.push("location");
  if (seniority(currentRole) === "unknown") missing.push("seniority_band");
  if (!sectorTags.length) missing.push("sector_tags");
  if (!roles.size) missing.push("school_ecosystem_roles");
  if (exposure === "unknown") missing.push("school_exposure");
  if (!careerSummary) missing.push("career_summary");

  const present = 8 - missing.length;
  const confidence = Math.round((0.65 * (present / 8) + 0.35 * Math.min(1, spans.length / 5)) * 100) / 100;

  const roleList = [...roles];
  const queryTerms = [
    ...roleList,
    ...(currentRole ? [currentRole] : []),
    ...sectorTags.filter((t) => t !== "higher_education").map((t) => t.replace(/_/g, " ")),
    "schools",
    ...(exposure === "multi_school" || exposure === "school_group" ? ["multiple schools", "school group", "network of schools"] : []),
    ...(filteredFamilies.includes("education_consulting") ? ["school consultant", "education advisor"] : []),
    ...(filteredFamilies.includes("school_leadership") ? ["principal", "head of school"] : []),
    ...(filteredFamilies.includes("school_ownership_governance") ? ["trustee", "school owner"] : []),
  ];
  const queryExpanded = expandSynonyms(queryTerms);

  const referenceDocument = [
    `Role: ${currentRole ?? ""}`,
    `Organisation: ${organisation ?? ""}`,
    `Career: ${careerSummary ?? ""}`,
    `Professional summary: ${text}`,
    `School roles: ${roleList.join(", ")}`,
    `Sector: ${sectorTags.join(", ")}`,
    `School exposure: ${exposure.replace(/_/g, " ")}`,
    `Location: ${loc.location ?? ""}`,
  ].join("\n");
  const roleDocument = [currentRole ?? "", roleList.join(" "), filteredFamilies.map((f) => ROLE_FAMILIES[f]).join(" "), organisation ?? ""].join(" ");

  return {
    analyzer_version: ANALYZER_VERSION,
    display_name: input.displayName.trim(),
    current_role: currentRole,
    current_organisation: organisation,
    location: loc.location,
    region: loc.region,
    country: loc.country,
    seniority_band: seniority(currentRole),
    career_summary: careerSummary,
    sector_tags: [...new Set(sectorTags)],
    school_ecosystem_roles: roleList,
    role_families: filteredFamilies,
    school_exposure: exposure,
    multi_school_exposure: exposure === "multi_school" || exposure === "school_group",
    leadership_indicators: leadership,
    influence_indicators: influence,
    evidence_spans: spans.sort((a, b) => a.start - b.start),
    missing_fields: missing,
    analysis_confidence: confidence,
    normalised_text: text,
    query_terms: queryExpanded,
    reference_document: referenceDocument,
    role_document: roleDocument,
  };
}

export function formerRoleHint(text: string): boolean {
  return FORMER_RE.test(text);
}
