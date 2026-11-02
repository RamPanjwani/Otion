export default function Loading({ fullPage = false, label = 'Loading' }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-sm text-muted ${fullPage ? 'min-h-screen' : 'py-12'}`}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" />
      <span>{label}</span>
    </div>
  );
}
