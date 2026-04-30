function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-48 mb-2" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card-bg shadow-sm overflow-hidden">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3 mt-3" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
