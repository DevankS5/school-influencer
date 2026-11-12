import { DOMAIN_COMMON, STOPWORDS, SYNONYM_GROUPS } from "./taxonomy";

export const EMBEDDING_MODEL = "edxso-hash-concept-embed";
export const EMBEDDING_REVISION = "v1.0.0";
export const EMBEDDING_DIM = 512;
export const DOC_TEMPLATE_VERSION = "candidate-doc-v1";

export function normaliseWhitespace(s: string): string {
  return s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function normaliseKey(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms|shri|smt)\.?\s/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/k-12/g, "k12")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

/** Concept tokens give synonym phrases a shared dimension (principal == head of school). */
export function conceptTokens(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const g of SYNONYM_GROUPS) {
    let hits = 0;
    for (const p of g.phrases) if (lower.includes(p)) hits++;
    if (hits > 0) out.push(`c_${g.id}`);
  }
  return out;
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic embedding: signed feature hashing over unigrams, bigrams and
 * synonym-concept tokens, sublinear tf, L2 normalised. No network, no model
 * download, fully reproducible. Swappable for a neural model behind the same
 * interface. It captures lexical + concept overlap, NOT factual truth.
 */
export function embed(text: string): number[] {
  const toks = tokenise(text);
  const feats = new Map<string, number>();
  const add = (f: string, w: number) => feats.set(f, (feats.get(f) ?? 0) + w);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    add(`u:${t}`, DOMAIN_COMMON.has(t) ? 0.35 : 1);
    if (i + 1 < toks.length) add(`b:${t}_${toks[i + 1]}`, 0.8);
  }
  for (const c of conceptTokens(text)) add(c, 2.2);
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  for (const [f, tf] of feats) {
    const h = fnv1a(f);
    const idx = h % EMBEDDING_DIM;
    const sign = (h >>> 16) & 1 ? 1 : -1;
    vec[idx] += sign * (1 + Math.log(tf));
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => Math.round((v / norm) * 1e6) / 1e6);
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

/** Percentile calibration (monotonic) of values within a pool; ties share mid-rank. */
export function percentileCalibrate(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 0.5);
  return values.map((v) => {
    let below = 0;
    let equal = 0;
    for (const o of values) {
      if (o < v - 1e-12) below++;
      else if (Math.abs(o - v) <= 1e-12) equal++;
    }
    return (below + (equal - 1) / 2) / (n - 1);
  });
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a safe Postgres tsquery from phrases (words AND-ed within a phrase, phrases OR-ed). */
export function buildTsQuery(phrases: string[]): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const p of phrases) {
    const words = p
      .toLowerCase()
      .replace(/k-12/g, "k12")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w));
    if (!words.length) continue;
    const q = words.join(" & ");
    if (seen.has(q)) continue;
    seen.add(q);
    parts.push(words.length > 1 ? `(${q})` : q);
  }
  return parts.join(" | ");
}

export function expandSynonyms(terms: string[]): string[] {
  const out = new Set<string>();
  for (const t of terms) {
    const lower = t.toLowerCase();
    out.add(lower);
    for (const g of SYNONYM_GROUPS) {
      if (g.id === "k12" || g.id === "edtech" || g.id === "director") continue;
      if (g.phrases.some((p) => p === lower)) g.phrases.forEach((p) => out.add(p));
    }
  }
  return [...out];
}

export function sha1Like(s: string): string {
  // Small deterministic non-cryptographic content hash (hex) for provenance records.
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
