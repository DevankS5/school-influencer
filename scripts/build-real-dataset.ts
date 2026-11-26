/**
 * Build india-school-ecosystem-real-v1 from PUBLIC web pages, evidence first.
 *
 *   1. A recorded list of public pages (official school, school-group and education-NGO pages) found by web search.
 *   2. Each page is fetched and reduced to plain text.
 *   3. Gemini extracts people ONLY from that text. Every biography excerpt and every claim excerpt must appear
 *      verbatim in the fetched page, every enum must be in the controlled taxonomy; anything else is dropped.
 *
 * No LinkedIn, no contact details, professional role information only. Output is committed as JSON.
 *   npx tsx scripts/build-real-dataset.ts            (needs GEMINI_API_KEY)
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CLAIM_TYPES, ROLE_FAMILIES, SCHOOL_EXPOSURE } from "../src/lib/taxonomy";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error("GEMINI_API_KEY is required");
const OUT = "data/datasets/india-school-ecosystem-real-v1";
const UA = "EDXSO-SchoolInfluenceResearch/1.0 (public pages only; contact via repository)";

// Public pages found by ordinary web search on 2026-11-26 (queries: "principal's message CBSE school India",
// "school group India leadership team", "education NGO India leadership team"). Social media is excluded.
const SEED_URLS = [
  "https://dpsrkp.net/principals-message/",
  "https://dpsjoka.com/principals-message/",
  "https://campionschool.edu.in/principals-message/",
  "https://dwpszirakpur.com/principals-messages/",
  "https://mbs.ac.in/principals-message/",
  "https://surajschoolrewari.com/principal-message.php",
  "https://sgminternational.edu.in/vice-principals-message/",
  "https://amsaijunglighat.in/principal-message/",
  "https://www.vpmbrtol.co.in/principals-message/",
  "https://nhswb.com/founders/cbse-board/academics/principals-message/",
  "https://leadindiabharatratnas.in/about-us/principals-message/",
  "https://globalschools.com/about/board-of-advisors/",
  "https://internationalschoolspartnership.com/about-us/isp-leadership-team/",
  "http://highperformingeducator.com/atul-temurnikar/",
  "https://leadschool.in/about-us/leadership-team/",
  "https://alokit.org/",
  "https://www.kriyaa.co/our-team",
  "https://aspire-india.org/our-team-2/",
  "https://stireducation.org/who-we-are/",
  "https://prathamusa.org/about-us/leadership/",
  "https://www.teachforindia.org/leadership-team",
  "https://www.centralsquarefoundation.org/team",
];

// Free-tier quotas are per model and per day, so fall through a list of models when one is exhausted.
const MODELS = (process.env.GEMINI_MODELS || "gemini-3-flash-preview,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.8-flash,gemini-flash-latest,gemini-3-flash-preview,gemini-3.5-flash-lite,gemini-flash-lite-latest").split(",");
let modelIdx = 0;
async function gemini(body: unknown): Promise<any> {
  for (let attempt = 0; attempt < 12 && modelIdx < MODELS.length; attempt++) {
    const model = MODELS[modelIdx];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY! },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    }).catch(() => null);
    if (!r) { modelIdx++; continue; } // slow or unreachable model: try the next one
    if (r.ok) return { ...(await r.json()), model };
    const t = await r.text();
    if (r.status === 429 && /PerDay/.test(t)) { console.warn(`${model} daily quota used, next model`); modelIdx++; continue; }
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 5000)); continue; }
    if (r.status === 400 || r.status === 404) { console.warn(`${model} ${r.status}: ${t.slice(0, 120)}`); modelIdx++; continue; }
    throw new Error(`Gemini ${r.status}: ${t.slice(0, 200)}`);
  }
  return {}; // give up on this item, keep the run going
}

const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

function htmlToText(html: string): string {
  return norm(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section)>/gi, ". ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&ndash;|&mdash;/g, "-")
      .replace(/&#\d+;|&[a-z]+;/gi, " ")
      .replace(/(\.\s*){2,}/g, ". "),
  );
}

async function fetchPage(url: string): Promise<{ url: string; text: string } | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("html")) return null;
    const final = new URL(r.url);
    if (/linkedin\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com/i.test(final.hostname)) return null; // no social profiles
    const text = htmlToText(await r.text());
    console.log(`fetched ${final.hostname} ${text.length} chars`);
    return text.length > 300 ? { url: final.toString(), text } : null;
  } catch {
    return null;
  }
}

const CLAIMS = Object.keys(CLAIM_TYPES);
const FAMS = Object.keys(ROLE_FAMILIES);
const EXPS = Object.keys(SCHOOL_EXPOSURE);

async function extract(page: { url: string; text: string }) {
  const prompt = `You extract real professionals in India's school-education ecosystem from ONE web page.
Use ONLY the text between <page> tags. Never use outside knowledge. Return JSON: {"people": [...]}, at most 4 people, only people whose professional role is described on this page.
Each person: {"name": string, "title": string, "org": string, "city": string ("" if not stated),
 "status": "current"|"former"|"unknown",
 "bio": string  // ONE contiguous passage copied EXACTLY from the page (60-600 chars) that names the person and describes their role
 "claims": [{"type": one of ${JSON.stringify(CLAIMS)}, "excerpt": string /* copied EXACTLY from bio */}] (1-3 items),
 "fam": array from ${JSON.stringify(FAMS)},
 "exp": one of ${JSON.stringify(EXPS)},
 "roles": short lowercase role words e.g. ["principal"], "tags": e.g. ["K-12","CBSE"] }
Return {"people": []} if the page has no such person. No emails, phone numbers or personal details.
<page url="${page.url}">
${page.text.slice(0, 15000)}
</page>`;
  const res = await gemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", },
  });
  const raw = res.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "{}";
  try { return (JSON.parse(raw).people ?? []) as any[]; } catch { return []; }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const found = SEED_URLS;
  const pages = (await pool([...new Set(found)], 6, fetchPage)).filter(Boolean) as { url: string; text: string }[];
  const uniquePages = [...new Map(pages.map((p) => [p.url.replace(/[#?].*$/, ""), p])).values()];
  console.log(`seed pages ${found.length} -> fetched pages ${uniquePages.length}`);

  const rejected: { url: string; name: string; why: string }[] = [];
  const records: any[] = [];
  const seen = new Set<string>();
  // Cache model output per page so a rerun after a quota stop does not spend requests twice.
  mkdirSync(OUT, { recursive: true });
  const cacheFile = `${OUT}/.extract-cache.json`;
  const cache: Record<string, any[]> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
  const extracted = await pool(uniquePages, 2, async (p) => {
    const people = cache[p.url] ?? (process.env.CACHE_ONLY ? [] : await extract(p)); // CACHE_ONLY=1 builds from finished pages only
    cache[p.url] = people;
    writeFileSync(cacheFile, JSON.stringify(cache));
    console.log(`extract ${new URL(p.url).hostname}: ${people.length}`);
    return { p, people };
  });
  for (const { p, people } of extracted) {
    for (const x of people) {
      const name = norm(String(x.name ?? ""));
      const bio = norm(String(x.bio ?? ""));
      const why =
        !name || name.split(" ").length < 2 ? "no full name" :
        !p.text.includes(bio) ? "bio not verbatim on page" :
        !bio.includes(name.split(" ").at(-1)!) ? "bio does not name the person" :
        bio.length < 60 ? "bio too short" :
        !(x.claims ?? []).length ? "no claims" :
        (x.claims ?? []).some((c: any) => !CLAIMS.includes(c.type) || !bio.includes(norm(String(c.excerpt ?? "")))) ? "claim excerpt not in bio or unknown claim type" :
        !EXPS.includes(x.exp) ? "unknown exposure" :
        seen.has(name.toLowerCase()) ? "duplicate person" : null;
      if (why) { rejected.push({ url: p.url, name, why }); continue; }
      seen.add(name.toLowerCase());
      const fam = (x.fam ?? []).filter((f: string) => FAMS.includes(f));
      records.push({
        key: `r${String(records.length + 1).padStart(3, "0")}`,
        name, title: norm(String(x.title ?? "")).slice(0, 160), org: norm(String(x.org ?? "")).slice(0, 160) || new URL(p.url).hostname,
        city: norm(String(x.city ?? "")), status: ["current", "former", "unknown"].includes(x.status) ? x.status : "unknown",
        bio, career: [], tags: (x.tags ?? []).slice(0, 6).map(String), roles: (x.roles ?? []).slice(0, 4).map((r: string) => String(r).toLowerCase()),
        fam: fam.length ? fam : ["unknown"], exp: x.exp, q: x.claims.length >= 2 ? "high" : "medium", v: today, src: "official_organisation_page",
        ev: x.claims.map((c: any) => [c.type, norm(String(c.excerpt))]), url: p.url,
      });
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/records.json`, JSON.stringify(records, null, 1));
  writeFileSync(`${OUT}/build-report.json`, JSON.stringify({ built_on: today, models_used: MODELS.slice(0, modelIdx + 1), seed_urls: SEED_URLS,  pages_fetched: uniquePages.length, accepted: records.length, rejected }, null, 1));
  console.log(`accepted ${records.length}, rejected ${rejected.length}`);
}
main();
