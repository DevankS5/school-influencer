"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function postRun(body: Record<string, unknown>): Promise<{ ok: true; runId: string } | { ok: false; code: string; message: string }> {
  try {
    const res = await fetch("/api/v1/discovery-runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      const issue = data.issues?.[0];
      return { ok: false, code: data.error ?? "error", message: issue ? `${issue.path}: ${issue.message}` : (data.message ?? "Request failed.") };
    }
    return { ok: true, runId: data.run_id };
  } catch {
    return { ok: false, code: "network", message: "Could not reach the server. Please try again." };
  }
}

export function RunDemoButton({ referenceId, label = "Run discovery", variant = "primary" }: { referenceId: string; label?: string; variant?: "primary" | "ghost" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className={variant === "primary" ? "btn-primary" : "btn-ghost"}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await postRun({ reference_profile_id: referenceId, limit: 30, filters: { country: "India" } });
          if (r.ok) router.push(`/discover/${r.runId}`);
          else {
            setError(r.message);
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
            Analysing &amp; ranking…
          </>
        ) : (
          <>
            {label} <span aria-hidden>→</span>
          </>
        )}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-clay">{error}</p>}
    </div>
  );
}

type Tab = "paste" | "url";

const SAMPLE =
  "Anita Rao is Director of Academics at Northbrook Education Trust, a group of 8 CBSE schools in Hyderabad. She was Principal of Northbrook Junior School for ten years and now mentors principals across the group. She is a trustee of one school society and advises school boards on curriculum.";

export function ReferenceProfileForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("paste");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [org, setOrg] = useState("");
  const [loc, setLoc] = useState("");
  const [url, setUrl] = useState("");
  const [country, setCountry] = useState("India");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const base = { limit: 30, filters: { country: country === "any" ? null : country } };
    const body =
      tab === "paste"
        ? { ...base, profile_text: text, display_name: name, current_role: role || null, organisation: org || null, location: loc || null }
        : { ...base, profile_url: url };
    const r = await postRun(body);
    if (r.ok) router.push(`/discover/${r.runId}`);
    else {
      setError({ code: r.code, message: r.message });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 sm:p-8" aria-labelledby="ref-form-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Your own reference</p>
          <h2 id="ref-form-title" className="display mt-1 text-2xl font-semibold text-ink">Bring a profile you are permitted to use</h2>
        </div>
        <div role="tablist" className="flex rounded-full border border-line bg-fog p-1 text-sm">
          {([["paste", "Paste text"], ["url", "Profile URL"]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(null); }}
              className={`rounded-full px-4 py-1.5 font-medium transition ${tab === k ? "bg-pine text-paper" : "text-muted hover:text-pine"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === "paste" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="rf-name">Name or display label *</label>
            <input id="rf-name" className="field" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reference A" />
          </div>
          <div>
            <label className="label" htmlFor="rf-country">Candidate geography</label>
            <select id="rf-country" className="field" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="India">India only</option>
              <option value="any">Any country</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="rf-text">Profile text *</label>
            <textarea id="rf-text" className="field min-h-[150px] resize-y leading-relaxed" required minLength={80} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Paste a biography or profile summary. Every extracted indicator is tied back to a span of this text." />
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
              <button type="button" className="font-medium text-moss underline underline-offset-4" onClick={() => { setText(SAMPLE); if (!name) setName("Sample reference"); }}>Insert a sample</button>
              <span>{text.length} / 8000</span>
            </div>
          </div>
          <div><label className="label" htmlFor="rf-role">Current role (optional)</label><input id="rf-role" className="field" maxLength={160} value={role} onChange={(e) => setRole(e.target.value)} /></div>
          <div><label className="label" htmlFor="rf-org">Organisation (optional)</label><input id="rf-org" className="field" maxLength={160} value={org} onChange={(e) => setOrg(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="rf-loc">Location (optional)</label><input id="rf-loc" className="field" maxLength={160} value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="City, State" /></div>
        </div>
      ) : (
        <div className="mt-6">
          <label className="label" htmlFor="rf-url">Profile URL</label>
          <input id="rf-url" type="url" className="field" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          <p className="mt-3 rounded-2xl bg-brass-soft/70 px-4 py-3 text-xs leading-relaxed text-[#6b4c12]">
            URLs are never fetched automatically. Unless an authorised connector exists for the source, the API refuses the request and asks for pasted text or a seeded profile — this policy gate is intentional and you can see it respond below.
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className={`mt-5 rounded-2xl px-4 py-3 text-sm ${error.code === "no_authorised_connector" ? "bg-brass-soft text-[#6b4c12]" : "bg-clay-soft text-clay"}`}>
          {error.code === "no_authorised_connector" && <strong className="mr-1">Policy gate:</strong>}
          {error.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs leading-relaxed text-muted">Only the analysis is stored with the run. Nothing is sent to third-party services. Use only text you are authorised to supply.</p>
        <button className="btn-primary" disabled={busy}>
          {busy ? "Analysing & ranking…" : tab === "paste" ? "Analyse & discover →" : "Submit URL →"}
        </button>
      </div>
    </form>
  );
}
