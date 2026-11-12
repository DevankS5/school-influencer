import type { Metadata } from "next";
import { SettingsForm } from "@/components/SettingsForm";
import { getActiveConfig, listConfigs } from "@/lib/config";
import { ensureSeeded } from "@/lib/seed";

export const metadata: Metadata = { title: "Ranking settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureSeeded();
  const [active, versions] = await Promise.all([getActiveConfig(), listConfigs()]);
  return (
    <div className="space-y-10 pt-6">
      <header className="max-w-3xl">
        <p className="eyebrow">Administration</p>
        <h1 className="display mt-2 text-5xl font-semibold leading-[1.05]">Ranking configuration</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">Weights, retrieval depth and thresholds are versioned data, not hard-coded constants. Weights must be non-negative and sum to 1.0.</p>
      </header>
      <SettingsForm
        active={active}
        tokenRequired={!!process.env.ADMIN_TOKEN}
        versions={versions.map((v) => ({ version: v.version, is_active: v.isActive, notes: v.notes, created_at: v.createdAt.toISOString() }))}
      />
    </div>
  );
}
