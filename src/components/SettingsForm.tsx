"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FeatureKey, RankingConfig } from "@/lib/types";

const FEATURE_LABELS: Record<FeatureKey, string> = {
  school_ecosystem_relevance: "School ecosystem relevance",
  role_experience_similarity: "Role & experience similarity",
  multi_school_exposure: "Multi-school exposure",
  leadership_governance: "Leadership & governance",
  semantic_similarity: "Semantic similarity",
  network_connector_evidence: "Network / connector evidence",
  data_confidence: "Data confidence",
};

interface VersionRow { version: string; is_active: boolean; notes: string | null; created_at: string }

export function SettingsForm({ active, versions, tokenRequired }: { active: RankingConfig; versions: VersionRow[]; tokenRequired: boolean }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<RankingConfig>(active);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const sum = useMemo(() => Object.values(cfg.weights).reduce((a, b) => a + b, 0), [cfg.weights]);
  const sumOk = Math.abs(sum - 1) < 0.005;
  const headers = { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) };

  const setWeight = (k: FeatureKey, v: number) => setCfg((c) => ({ ...c, weights: { ...c.weights, [k]: Math.round(v * 100) / 100 } }));
  const normalise = () =>
    setCfg((c) => {
      const t = Object.values(c.weights).reduce((a, b) => a + b, 0) || 1;
      const w = Object.fromEntries(Object.entries(c.weights).map(([k, v]) => [k, Math.round((v / t) * 1000) / 1000])) as Record<FeatureKey, number>;
      const keys = Object.keys(w) as FeatureKey[];
      const drift = 1 - Object.values(w).reduce((a, b) => a + b, 0);
      w[keys[0]] = Math.round((w[keys[0]] + drift) * 1000) / 1000;
      return { ...c, weights: w };
    });

  async function call(body: unknown, success: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/settings", { method: "POST", headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.issues?.map((i: { message: string }) => i.message).join("; ") || data.message || "Failed." });
      else {
        setMsg({ ok: true, text: success });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setBusy(false);
  }

  const num = (v: string, d: number) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : d);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="card space-y-8 p-7 sm:p-9">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="display text-2xl font-semibold">Feature weights</h2>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${sumOk ? "bg-mist text-pine" : "bg-clay-soft text-clay"}`}>Σ = {sum.toFixed(2)}</span>
          </div>
          <ul className="mt-5 space-y-5">
            {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((k) => (
              <li key={k}>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor={`w-${k}`} className="font-medium">{FEATURE_LABELS[k]}</label>
                  <span className="tabular-nums text-muted">{cfg.weights[k].toFixed(2)}</span>
                </div>
                <input id={`w-${k}`} type="range" min={0} max={0.6} step={0.01} value={cfg.weights[k]} onChange={(e) => setWeight(k, Number(e.target.value))} className="mt-2 h-2 w-full cursor-pointer accent-pine" />
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost mt-5" onClick={normalise}>Normalise to 1.00</button>
        </section>

        <section className="grid gap-5 sm:grid-cols-3">
          <div><label className="label" htmlFor="lex">Lexical top-K</label><input id="lex" className="field" type="number" min={5} max={200} value={cfg.retrieval.lexical_top_k} onChange={(e) => setCfg({ ...cfg, retrieval: { ...cfg.retrieval, lexical_top_k: num(e.target.value, 50) } })} /></div>
          <div><label className="label" htmlFor="vec">Vector top-K</label><input id="vec" className="field" type="number" min={5} max={200} value={cfg.retrieval.vector_top_k} onChange={(e) => setCfg({ ...cfg, retrieval: { ...cfg.retrieval, vector_top_k: num(e.target.value, 50) } })} /></div>
          <div><label className="label" htmlFor="rrf">RRF k</label><input id="rrf" className="field" type="number" min={1} max={200} value={cfg.retrieval.rrf_k} onChange={(e) => setCfg({ ...cfg, retrieval: { ...cfg.retrieval, rrf_k: num(e.target.value, 60) } })} /></div>
          <div><label className="label" htmlFor="gmin">Gate: min school relevance</label><input id="gmin" className="field" type="number" step={0.05} min={0} max={1} value={cfg.gate.min_school_relevance} onChange={(e) => setCfg({ ...cfg, gate: { ...cfg.gate, min_school_relevance: num(e.target.value, 0.25) } })} /></div>
          <div><label className="label" htmlFor="gcap">Gate: score cap</label><input id="gcap" className="field" type="number" min={0} max={100} value={cfg.gate.cap} onChange={(e) => setCfg({ ...cfg, gate: { ...cfg.gate, cap: num(e.target.value, 40) } })} /></div>
          <div><label className="label" htmlFor="dmin">Default minimum score</label><input id="dmin" className="field" type="number" min={0} max={100} value={cfg.results.default_minimum_score} onChange={(e) => setCfg({ ...cfg, results: { ...cfg.results, default_minimum_score: num(e.target.value, 45) } })} /></div>
          <div><label className="label" htmlFor="bh">Band · High ≥</label><input id="bh" className="field" type="number" value={cfg.bands.high} onChange={(e) => setCfg({ ...cfg, bands: { ...cfg.bands, high: num(e.target.value, 80) } })} /></div>
          <div><label className="label" htmlFor="bs">Band · Strong ≥</label><input id="bs" className="field" type="number" value={cfg.bands.strong} onChange={(e) => setCfg({ ...cfg, bands: { ...cfg.bands, strong: num(e.target.value, 65) } })} /></div>
          <div><label className="label" htmlFor="bm">Band · Moderate ≥</label><input id="bm" className="field" type="number" value={cfg.bands.moderate} onChange={(e) => setCfg({ ...cfg, bands: { ...cfg.bands, moderate: num(e.target.value, 45) } })} /></div>
        </section>

        <section className="rounded-3xl bg-fog p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-pine" checked={cfg.diversity.enabled} onChange={(e) => setCfg({ ...cfg, diversity: { ...cfg.diversity, enabled: e.target.checked } })} />
            <span>
              <span className="block text-sm font-semibold">Diversity re-ranking (MMR)</span>
              <span className="block text-xs leading-relaxed text-muted">Off by default: enable only if it improves reviewer-rated usefulness. Penalises same-organisation and same-role-family repetition.</span>
            </span>
          </label>
          {cfg.diversity.enabled && (
            <div className="mt-4">
              <label className="label" htmlFor="lam">Relevance preference λ · {cfg.diversity.lambda.toFixed(2)}</label>
              <input id="lam" type="range" min={0.5} max={1} step={0.05} value={cfg.diversity.lambda} onChange={(e) => setCfg({ ...cfg, diversity: { ...cfg.diversity, lambda: Number(e.target.value) } })} className="h-2 w-full accent-pine" />
            </div>
          )}
        </section>

        <section className="grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div><label className="label" htmlFor="ver">New version label *</label><input id="ver" className="field" placeholder="hybrid-v1.1" value={version} onChange={(e) => setVersion(e.target.value)} /></div>
          <div><label className="label" htmlFor="notes">Change notes</label><input id="notes" className="field" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this change?" /></div>
          {tokenRequired && <div className="sm:col-span-2"><label className="label" htmlFor="tok">Administrator token</label><input id="tok" type="password" className="field" value={token} onChange={(e) => setToken(e.target.value)} /></div>}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn-primary" disabled={busy || !sumOk || !version} onClick={() => call({ action: "create", config: { ...cfg, version }, notes, activate: true }, `Saved and activated ${version}. New runs use it.`)}>
              Save as new version &amp; activate
            </button>
            {!sumOk && <span className="text-xs text-clay">Weights must sum to 1.00</span>}
            {msg && <span role="status" className={`text-sm ${msg.ok ? "text-pine" : "text-clay"}`}>{msg.text}</span>}
          </div>
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="card p-6">
          <p className="eyebrow">Versions</p>
          <ul className="mt-4 space-y-2.5">
            {versions.map((v) => (
              <li key={v.version} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{v.version}</p>
                  <p className="truncate text-xs text-muted">{v.notes ?? "—"}</p>
                </div>
                {v.is_active ? <span className="chip">Active</span> : (
                  <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => call({ action: "activate", version: v.version }, `Activated ${v.version}.`)}>Activate</button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="card-flat p-5 text-xs leading-relaxed text-muted">
          <p className="eyebrow mb-2">Why versions are immutable</p>
          Every run stores a snapshot of the configuration it used, so a past result can always be reproduced. Weights here are an uncalibrated hypothesis — compare variants on the Evaluation page before trusting any change.
        </div>
      </aside>
    </div>
  );
}
