export default function Loading() {
  return (
    <div className="flex justify-center py-16" aria-busy="true" aria-label="読み込み中">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
    </div>
  );
}
