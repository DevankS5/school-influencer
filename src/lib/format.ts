export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function bandTone(score: number, bands: { high: number; strong: number; moderate: number }) {
  if (score >= bands.high) return { label: "High match", stroke: "#17453a", chip: "chip", text: "text-pine" };
  if (score >= bands.strong) return { label: "Strong match", stroke: "#3b7a58", chip: "chip", text: "text-moss" };
  if (score >= bands.moderate) return { label: "Moderate match", stroke: "#b8893a", chip: "chip-brass", text: "text-[#7a5614]" };
  return { label: "Weak match", stroke: "#b5532f", chip: "chip-clay", text: "text-clay" };
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
