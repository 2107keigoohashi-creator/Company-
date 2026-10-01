import { requireOwner } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase } = await requireOwner();

  // 初回ログイン時: 設定行と 8 社員を作成(冪等)
  const { count: employeeCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true });
  if (!employeeCount) {
    const { error } = await supabase.rpc("bootstrap_owner");
    if (error) throw new Error(`初期セットアップに失敗しました: ${error.message}`);
  }

  const { count: pending } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <>
      <div className="pb-tabbar mx-auto min-h-dvh max-w-xl px-4">{children}</div>
      <BottomNav pendingApprovals={pending ?? 0} />
    </>
  );
}
