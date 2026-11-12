import Link from "next/link";
import { ReferenceProfileForm, RunDemoButton } from "@/components/RunForms";
import { getActiveConfig } from "@/lib/config";
import { listRecentRuns } from "@/lib/pipeline";
import { getBatch } from "@/lib/queries";
import { FEATURES } from "@/lib/taxonomy";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STEPS = [
  { t: "Interpret", d: "Rules extract role, organisation, geography, school exposure and leadership signals — each tied to a span of source text. Unknowns stay empty." },
  { t: "Retrieve", d: "Postgres full-text search (with synonym expansion) and vector similarity each nominate candidates; reciprocal rank fusion merges them." },
  { t: "Filter", d: "Self-matches, duplicates and records with no source or evidence are removed. Every removal is counted and shown." },
  { t: "Rank", d: "Seven inspectable features are combined with editable weights. Missing data is renormalised, never treated as proof of absence." },
  { t: "Explain", d: "Each result quotes the exact source excerpts behind its score, validated against evidence IDs before display." },
];

const BAR_TONES = ["#17453a", "#2a6650", "#3b7a58", "#5d9573", "#8db39a", "#b8893a", "#d6bf86"];

export default async function HomePage() {
  const [batch, config, runs] = await Promise.all([getBatch(), getActiveConfig(), listRecentRuns(4)]);
  const q = batch.qualityReport as Record<string, number>;
  const stats = [
    { n: q.total_people, l: "canonical people" },
    { n: q.total_source_records, l: "source records" },
    { n: q.total_evidence_items, l: "evidence excerpts" },
    { n: q.duplicates_merged, l: "duplicates merged" },
  ];

  return (
    <div className="space-y-24">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="rise">
          <span className="chip-brass">Corpus-first · explainable · traceable</span>
          <h1 className="display mt-5 text-[clamp(2.4rem,5.4vw,4.2rem)] font-semibold leading-[1.02] text-ink">
            Find the professionals who work <em className="text-moss">across</em> India&apos;s schools, and see exactly why.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Give EDXSO one reference professional. It reads the profile, searches a source-attributed corpus, and returns a ranked shortlist where every score can be opened up and checked against evidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <RunDemoButton referenceId="demo-ref-001" label="Run the live demo" />
            <Link href="/demo" className="btn-ghost">Choose a reference</Link>
            <a href="#how" className="px-2 text-sm font-medium text-pine underline decoration-sage decoration-2 underline-offset-4">How it ranks</a>
          </div>
          <dl className="mt-10 flex flex-wrap gap-3">
            {stats.map((s) => (
              <div key={s.l} className="rounded-full border border-line bg-card/80 px-5 py-2.5">
                <dt className="sr-only">{s.l}</dt>
                <dd className="flex items-baseline gap-2"><span className="display text-2xl font-semibold text-pine">{s.n}</span><span className="text-xs text-muted">{s.l}</span></dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rise relative mx-auto aspect-square w-full max-w-[460px]" style={{ animationDelay: "120ms" }} aria-hidden>
          <div className="absolute inset-0 rounded-[46%_54%_52%_48%/52%_46%_54%_48%] bg-gradient-to-br from-pine via-pine-2 to-moss shadow-[0_40px_80px_-40px_rgba(16,38,30,0.8)]" />
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
            <g fill="none" stroke="#e1ece1" strokeOpacity="0.22">
              <circle cx="200" cy="200" r="70" /><circle cx="200" cy="200" r="125" /><circle cx="200" cy="200" r="170" strokeDasharray="3 7" />
            </g>
            <g stroke="#8db39a" strokeOpacity="0.55" strokeWidth="1.2">
              <line x1="200" y1="200" x2="118" y2="132" /><line x1="200" y1="200" x2="290" y2="120" /><line x1="200" y1="200" x2="320" y2="230" />
              <line x1="200" y1="200" x2="250" y2="320" /><line x1="200" y1="200" x2="110" y2="290" /><line x1="200" y1="200" x2="72" y2="212" />
            </g>
            <g>
              <circle cx="200" cy="200" r="30" fill="#f5f2e9" /><circle cx="200" cy="200" r="38" fill="none" stroke="#b8893a" strokeWidth="2" />
              <path d="M200 214v-12" stroke="#17453a" strokeWidth="2.4" strokeLinecap="round" /><path d="M200 204c0-7-4.6-11-11.5-11.5-.4 7 4 11.8 11.5 11.5Z" fill="#3b7a58" /><path d="M200 200c0-6 4-10 10.4-10.4.3 6.3-3.7 10.7-10.4 10.4Z" fill="#17453a" />
            </g>
            {[[118, 132, 17, "#e1ece1"], [290, 120, 13, "#e1ece1"], [320, 230, 19, "#b8893a"], [250, 320, 14, "#e1ece1"], [110, 290, 16, "#8db39a"], [72, 212, 11, "#e1ece1"]].map(([x, y, r, f], i) => (
              <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={f as string} />
            ))}
          </svg>
          {[
            ["top-[8%] left-[2%]", "Former principal → advisor"],
            ["top-[4%] right-[0%]", "Trustee · 3 societies"],
            ["top-[52%] right-[-4%]", "School-group CEO"],
            ["bottom-[6%] right-[14%]", "Programme · 60 schools"],
            ["bottom-[14%] left-[-2%]", "Accreditation · 40 schools"],
          ].map(([pos, label]) => (
            <span key={label} className={`absolute ${pos} rounded-full bg-card px-3.5 py-1.5 text-[11px] font-semibold text-pine shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)]`}>{label}</span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-8">
        <div className="max-w-2xl">
          <p className="eyebrow">Pipeline</p>
          <h2 className="display mt-2 text-4xl font-semibold leading-tight">Five stages, each one inspectable</h2>
          <p className="mt-3 text-muted">An LLM is never the source of a fact and never changes a score. Ranking is deterministic: the same corpus, configuration and reference always produce the same list.</p>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card relative p-5 pt-6" style={{ borderRadius: i % 2 ? "28px 28px 28px 8px" : "28px 8px 28px 28px" }}>
              <span className="display absolute -top-3 left-5 flex h-8 w-8 items-center justify-center rounded-full bg-pine text-sm font-semibold text-paper">{i + 1}</span>
              <h3 className="display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Weights */}
      <section className="card grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="eyebrow">Hybrid ranker · {config.version}</p>
          <h2 className="display mt-2 text-3xl font-semibold leading-tight">A weighted formula you can read, not a black box</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Weights are a starting hypothesis, versioned in the database and editable in Settings. A school-evidence gate caps any profile with no supported school-sector work, so a generic &ldquo;Founder&rdquo; or &ldquo;Consultant&rdquo; cannot rank highly on title alone.
          </p>
          <Link href="/settings" className="btn-ghost mt-5">Adjust weights</Link>
        </div>
        <div>
          <div className="flex h-5 overflow-hidden rounded-full ring-1 ring-line" role="img" aria-label="Feature weights">
            {FEATURES.map((f, i) => <div key={f.key} style={{ width: `${config.weights[f.key] * 100}%`, background: BAR_TONES[i] }} title={`${f.label} ${Math.round(config.weights[f.key] * 100)}%`} />)}
          </div>
          <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <li key={f.key} className="flex items-start gap-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: BAR_TONES[i] }} />
                <div>
                  <p className="text-sm font-medium">{f.label} <span className="text-muted">· {Math.round(config.weights[f.key] * 100)}%</span></p>
                  <p className="text-xs leading-relaxed text-muted">{f.blurb}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Form */}
      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-5">
          <p className="eyebrow">Reference input</p>
          <h2 className="display text-4xl font-semibold leading-tight">Seeded, pasted — or refused, by design</h2>
          <p className="text-muted">Three input paths exist and exactly one may be used per run. A URL is never silently fetched: without an authorised connector, the API says so and asks for text you&apos;re entitled to use.</p>
          <ul className="space-y-3 text-sm">
            {[
              ["Seeded profile", "One-click demo with three fictional references."],
              ["Pasted text", "Analysed in-process; indicators are linked to your text."],
              ["Profile URL", "Policy-gated: no scraping, no login automation."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brass" /><span><strong className="font-semibold">{t}.</strong> <span className="text-muted">{d}</span></span></li>
            ))}
          </ul>
        </div>
        <ReferenceProfileForm />
      </section>

      {runs.length > 0 && (
        <section>
          <p className="eyebrow">Recent runs</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/discover/${r.id}`} className="card-flat flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-mist/60">
                  <div>
                    <p className="font-medium">{r.referenceLabel}</p>
                    <p className="text-xs text-muted">{fmtDate(r.createdAt)} · {r.candidateCount} scored · {r.relevantCount} relevant</p>
                  </div>
                  <span aria-hidden className="text-moss">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
