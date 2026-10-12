// Shown instantly while a tab's live data loads. Next.js prefetches this shell for every nav link,
// so switching tabs responds immediately instead of freezing on the previous page.
function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Block className="h-3 w-40 rounded-full" />
        <Block className="h-10 w-80 max-w-full rounded-xl" />
        <Block className="h-4 w-[34rem] max-w-full rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Block key={i} className="h-28" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Block className="h-72 lg:col-span-2" />
        <Block className="h-72" />
      </div>
    </div>
  );
}
