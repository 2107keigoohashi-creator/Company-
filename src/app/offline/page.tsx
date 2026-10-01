export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold text-accent">オフラインです</h1>
      <p className="text-muted">電波の良い場所で再読み込みしてください。</p>
    </main>
  );
}
