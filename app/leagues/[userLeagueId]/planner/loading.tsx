export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8" aria-busy="true">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block size-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-700 dark:border-t-neutral-200"
        />
        <div>
          <h1 className="text-2xl font-semibold">Weekly planner</h1>
          <p className="text-sm text-neutral-500">Loading lineups, schedule and projections…</p>
        </div>
      </div>
      {/* Skeleton of the roster grid: 7 day columns. */}
      <div className="flex animate-pulse flex-col gap-1.5">
        {Array.from({ length: 8 }, (_, r) => (
          <div key={r} className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: 8 }, (_, c) => (
              <div key={c} className={`h-10 rounded bg-neutral-100 dark:bg-neutral-900 ${c === 0 ? "w-10" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
