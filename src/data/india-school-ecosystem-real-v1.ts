import type { RawRecord, SeedReference } from "./india-school-ecosystem-v1";
import records from "../../data/datasets/india-school-ecosystem-real-v1/records.json";

/**
 * india-school-ecosystem-real-v1: REAL professionals from public web pages.
 * Built by scripts/build-real-dataset.ts: pages found by web search, people extracted by Gemini from the fetched
 * page text only, and every biography and evidence excerpt checked verbatim against that page.
 * Professional role information only: no contact details, no LinkedIn, no social-media profiles.
 */
export const DATASET_META = {
  version: "india-school-ecosystem-real-v1",
  title: "India school ecosystem: real public-source profiles",
  origin: "public_web" as const,
  asOf: "2026-11-26T00:00:00.000Z",
  description:
    "Real school principals, school-group leaders, education-NGO and school-services leaders named on their organisations' own public pages. Each record keeps the source URL and verbatim excerpts.",
  licenceNotes:
    "Short factual excerpts quoted from publicly available organisational web pages, with the source URL, for research and evaluation. Professional information only. Removal or correction requests are honoured via /api/v1/corrections.",
  publisher: "Organisation's own public web page",
  accessMethod: "public_web_fetch_llm_extract_verbatim_verified",
  permissionNotes: "Publicly available page; excerpt verified verbatim on fetch. Not scraped from LinkedIn or social media.",
};

export const RECORDS = records as unknown as RawRecord[];

// Reference people for the demo: real records with the most evidence (they are self-excluded from their own runs).
export const REFERENCES: SeedReference[] = [...RECORDS]
  .sort((a, b) => b.ev.length - a.ev.length || a.key.localeCompare(b.key))
  .slice(0, 3)
  .map((r, i) => ({
    id: `real-ref-00${i + 1}`,
    displayName: r.name,
    currentRole: r.title,
    organisation: r.org,
    location: r.city,
    headline: `${r.title}, ${r.org}`,
    profileText: r.bio,
  }));

export function splitFor(index: number): "train" | "heldout" {
  return index % 3 === 0 ? "heldout" : "train";
}
