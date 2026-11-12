"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/demo", label: "Demo" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/governance", label: "Governance" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav aria-label="Primary" className="flex max-w-[62vw] items-center gap-1 overflow-x-auto rounded-full border border-line bg-card/90 p-1 shadow-[0_8px_24px_-16px_rgba(16,38,30,0.5)] backdrop-blur sm:max-w-none">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
            active(l.href) ? "bg-pine text-paper" : "text-muted hover:bg-mist hover:text-pine"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
