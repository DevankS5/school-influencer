"use client";

import { useState } from "react";

export function CorrectionForm({ personId, personName, compact = false }: { personId?: string; personName?: string; compact?: boolean }) {
  const [type, setType] = useState<"correction" | "removal">("correction");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; text?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/v1/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: personId ?? null, request_type: type, contact, message }),
      });
      const data = await res.json();
      if (!res.ok) setState({ kind: "error", text: data.issues?.[0]?.message ?? data.message ?? "Could not submit." });
      else {
        setState({ kind: "done", text: `Request ${data.request_id} logged. A reviewer will follow up.` });
        setMessage("");
      }
    } catch {
      setState({ kind: "error", text: "Network error. Please try again." });
    }
  }

  return (
    <form onSubmit={submit} className={compact ? "card-flat space-y-3 p-5" : "card space-y-4 p-7"}>
      <div>
        <p className="eyebrow">Correction &amp; removal</p>
        <h3 className="display mt-1 text-xl font-semibold">{personName ? `Is something wrong about ${personName}?` : "Request a correction or removal"}</h3>
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Request type">
        {(["correction", "removal"] as const).map((t) => (
          <button type="button" key={t} role="radio" aria-checked={type === t} onClick={() => setType(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${type === t ? "bg-pine text-paper" : "border border-line bg-card text-muted hover:bg-mist"}`}>{t}</button>
        ))}
      </div>
      <div>
        <label className="label" htmlFor={`cf-contact-${personId ?? "g"}`}>Contact</label>
        <input id={`cf-contact-${personId ?? "g"}`} className="field" required minLength={3} maxLength={160} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone" />
      </div>
      <div>
        <label className="label" htmlFor={`cf-msg-${personId ?? "g"}`}>Details</label>
        <textarea id={`cf-msg-${personId ?? "g"}`} className="field min-h-[96px]" required minLength={10} maxLength={1500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What should change, and why?" />
      </div>
      {state.kind === "done" && <p role="status" className="rounded-2xl bg-mist px-4 py-2.5 text-sm text-pine">{state.text}</p>}
      {state.kind === "error" && <p role="alert" className="rounded-2xl bg-clay-soft px-4 py-2.5 text-sm text-clay">{state.text}</p>}
      <button className="btn-primary" disabled={state.kind === "busy"}>{state.kind === "busy" ? "Sending…" : "Submit request"}</button>
    </form>
  );
}
