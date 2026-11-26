import { ACTIVE } from "@/data/active";
import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#17453a" />
      <path d="M20 31V19.5" stroke="#e1ece1" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 21c0-5.2-3.4-8.4-8.6-8.6-.3 5.3 3 8.9 8.6 8.6Z" fill="#8db39a" />
      <path d="M20 18c0-4.6 3-7.6 7.8-7.9.2 4.8-2.8 8.1-7.8 7.9Z" fill="#e1ece1" />
      <circle cx="12" cy="30" r="1.7" fill="#b8893a" />
      <circle cx="28.5" cy="29" r="1.4" fill="#8db39a" />
      <circle cx="20" cy="33" r="1.2" fill="#e1ece1" />
    </svg>
  );
}

export function SyntheticBanner() {
  return (
    <div className="flex items-center justify-center gap-3 bg-ink px-4 py-2 text-center text-[12px] text-mist">
      <span className="rounded-full bg-brass px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">Synthetic test data</span>
      <span className="hidden sm:inline">
        Every person in this demo is fictional. Results show how the pipeline works — not real-world discovery quality.
      </span>
      <span className="sm:hidden">Fictional people · pipeline demo</span>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pt-5 sm:px-8">
      <Link href="/" className="flex items-center gap-3">
        <Logo />
        <span className="leading-tight">
          <span className="display block text-xl font-semibold tracking-tight text-pine">EDXSO</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">School influence discovery</span>
        </span>
      </Link>
      <NavLinks />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line/80 bg-fog/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 text-sm text-muted sm:grid-cols-3 sm:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="display text-lg font-semibold text-pine">EDXSO</span>
          </div>
          <p className="mt-3 max-w-xs leading-relaxed">
            A corpus-first research tool for finding professionals with documented relevance to India&apos;s school-education ecosystem.
          </p>
        </div>
        <div>
          <p className="eyebrow">What this tool does not do</p>
          <ul className="mt-3 space-y-1.5 leading-relaxed">
            <li>No LinkedIn scraping or login automation</li>
            <li>No claims about private connections</li>
            <li>No outreach, messaging or contact harvesting</li>
            <li>Scores are research leads, not verified introductions</li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Reproducibility</p>
          <ul className="mt-3 space-y-1.5 leading-relaxed">
            <li>Dataset · {ACTIVE.DATASET_META.version}</li>
            <li>Ranker · hybrid-v1 (weights editable)</li>
            <li>
              <Link href="/governance" className="underline decoration-sage underline-offset-4 hover:text-pine">
                Data governance &amp; corrections
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
