import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getSettings, monthlyUsage } from "@/lib/ai/usage";
import { formatJst } from "@/lib/time";
import type { AuditLog } from "@/lib/types";
import { Button, Card, PageHeader } from "@/components/ui";
import { UsageCard } from "@/components/usage-card";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const { supabase, user } = await requireOwner();
  const [settings, usage, { data: logs }] = await Promise.all([
    getSettings(supabase),
    monthlyUsage(supabase),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50).returns<AuditLog[]>(),
  ]);

  return (
    <>
      <PageHeader title="設定" />
      <div className="space-y-6">
        <UsageCard usage={usage} settings={settings} />
        <SettingsForm settings={settings} />

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-muted">監査ログ(直近50件)</h2>
          <Card className="divide-y divide-line p-0">
            {(logs ?? []).map((l) => (
              <div key={l.id} className="space-y-0.5 px-3 py-2 text-xs" data-testid="audit-log">
                <div className="flex justify-between gap-2">
                  <span className={l.actor === "owner" ? "font-bold text-accent" : "font-bold text-violet-300"}>{l.actor}</span>
                  <span className="text-muted">{formatJst(l.created_at)}</span>
                </div>
                <div className="font-mono">{l.action}</div>
                {Object.keys(l.detail ?? {}).length > 0 && (
                  <div className="truncate text-muted">{JSON.stringify(l.detail)}</div>
                )}
              </div>
            ))}
            {(logs ?? []).length === 0 && <p className="p-3 text-sm text-muted">まだ記録がありません</p>}
          </Card>
        </section>

        <Card className="space-y-3">
          <p className="text-sm text-muted">ログイン中: {user.email}</p>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="secondary" className="w-full">
              ログアウト
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
