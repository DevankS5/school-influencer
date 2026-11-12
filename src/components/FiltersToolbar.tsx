"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export interface FilterOptions {
  regions: string[];
  categories: { value: string; label: string }[];
  sources: { value: string; label: string }[];
  defaultMin: number;
}

export function FiltersToolbar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const get = (k: string) => sp.get(k) ?? "";

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value === "" || value === "0" && key === "multi") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  }

  const active = ["region", "category", "min", "status", "multi", "source", "sort"].some((k) => sp.has(k));
  const sel = "field !rounded-full !py-2 !pl-4 !pr-8 text-[13px]";

  return (
    <div className={`card-flat flex flex-wrap items-end gap-x-4 gap-y-3 p-4 transition ${pending ? "opacity-70" : ""}`} role="search" aria-label="Filter and sort results">
      <div className="min-w-[140px] flex-1">
        <label className="label" htmlFor="f-region">Location</label>
        <select id="f-region" className={sel} value={get("region")} onChange={(e) => set("region", e.target.value)}>
          <option value="">All regions</option>
          {options.regions.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div className="min-w-[160px] flex-1">
        <label className="label" htmlFor="f-cat">Category</label>
        <select id="f-cat" className={sel} value={get("category")} onChange={(e) => set("category", e.target.value)}>
          <option value="">All categories</option>
          {options.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="min-w-[120px]">
        <label className="label" htmlFor="f-status">Role</label>
        <select id="f-status" className={sel} value={get("status")} onChange={(e) => set("status", e.target.value)}>
          <option value="">Current &amp; former</option>
          <option value="current">Current</option>
          <option value="former">Former</option>
        </select>
      </div>
      <div className="min-w-[160px] flex-1">
        <label className="label" htmlFor="f-src">Source type</label>
        <select id="f-src" className={sel} value={get("source")} onChange={(e) => set("source", e.target.value)}>
          <option value="">Any source</option>
          {options.sources.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="w-[130px]">
        <label className="label" htmlFor="f-min">Min score · {get("min") || options.defaultMin}</label>
        <input id="f-min" type="range" min={0} max={95} step={5} className="h-2 w-full cursor-pointer accent-pine" value={get("min") || options.defaultMin}
          onChange={(e) => set("min", e.target.value)} />
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[13px] font-medium text-ink">
        <input type="checkbox" className="h-4 w-4 accent-pine" checked={get("multi") === "1"} onChange={(e) => set("multi", e.target.checked ? "1" : "")} />
        Multi-school only
      </label>
      <div className="min-w-[180px]">
        <label className="label" htmlFor="f-sort">Sort by</label>
        <select id="f-sort" className={sel} value={get("sort")} onChange={(e) => set("sort", e.target.value)}>
          <option value="">Overall relevance</option>
          <option value="school">School-sector relevance</option>
          <option value="leadership">Leadership / governance</option>
          <option value="multi">Multi-school exposure</option>
          <option value="confidence">Data confidence</option>
        </select>
      </div>
      {active && (
        <button type="button" className="btn-ghost !py-2 text-[13px]" onClick={() => start(() => router.replace(path, { scroll: false }))}>
          Reset
        </button>
      )}
    </div>
  );
}
