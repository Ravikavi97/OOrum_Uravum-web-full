function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      {/* Title */}
      <Skeleton className="h-9 w-full mb-2" />
      <Skeleton className="h-9 w-3/4 mb-4" />
      {/* Meta */}
      <div className="flex gap-4 mb-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      {/* Featured image */}
      <Skeleton className="aspect-[16/9] w-full rounded-xl mb-8" />
      {/* Content lines */}
      <div className="space-y-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-4/5' : 'w-full'}`} />
        ))}
      </div>
    </main>
  );
}
