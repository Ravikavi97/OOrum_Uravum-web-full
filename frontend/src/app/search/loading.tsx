function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card-bg shadow-sm overflow-hidden">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
