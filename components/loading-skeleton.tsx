export function LoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="min-h-[360px] animate-pulse rounded-[28px] bg-[rgba(0,0,0,0.08)]" />

      <div className="space-y-4">
        <div className="h-5 w-24 animate-pulse rounded-full bg-[rgba(0,0,0,0.1)]" />
        <div className="h-12 w-3/4 animate-pulse rounded-2xl bg-[rgba(0,0,0,0.08)]" />
        <div className="h-5 w-full animate-pulse rounded-full bg-[rgba(0,0,0,0.08)]" />
        <div className="h-5 w-5/6 animate-pulse rounded-full bg-[rgba(0,0,0,0.08)]" />

        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-white"
            >
              <div className="aspect-[850/1125] animate-pulse bg-[rgba(0,0,0,0.08)]" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-3/4 animate-pulse rounded-full bg-[rgba(0,0,0,0.08)]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(0,0,0,0.06)]" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-[rgba(0,0,0,0.06)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
