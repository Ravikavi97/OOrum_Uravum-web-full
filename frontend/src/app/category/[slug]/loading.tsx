function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card-bg shadow-sm overflow-hidden">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
              <div className="flex justify-between pt-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
