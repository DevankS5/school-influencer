import type { ResultFilters } from "./pipeline";

/** Shared parsing for results filters (query string -> typed filters). */
export function parseResultFilters(sp: Record<string, string | string[] | undefined>, defaultMin: number): ResultFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) || undefined;
  };
  const min = one("min");
  return {
    region: one("region"),
    category: one("category"),
    minScore: min !== undefined && min !== "" && !Number.isNaN(Number(min)) ? Math.min(100, Math.max(0, Number(min))) : defaultMin,
    status: one("status"),
    multi: one("multi") === "1",
    sourceType: one("source"),
    sort: one("sort"),
  };
}
