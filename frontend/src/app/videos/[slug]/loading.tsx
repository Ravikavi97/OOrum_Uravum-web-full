function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full mt-4 rounded-xl" />
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-card-bg rounded-xl p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-2">
                <Skeleton className="w-32 h-20 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
