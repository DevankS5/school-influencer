import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader, SyntheticBanner } from "@/components/Chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EDXSO · School Influence Discovery", template: "%s · EDXSO" },
  description:
    "Evidence-backed discovery and ranking of professionals relevant to India's school-education ecosystem. Corpus-first, explainable, and traceable.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <SyntheticBanner />
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-6 sm:px-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
