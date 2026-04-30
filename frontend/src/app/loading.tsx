/**
 * Skeleton loading page — shown instantly while the homepage data loads.
 * Mirrors the exact layout of the real homepage for a seamless transition.
 */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded ${className}`} />;
}

/* ── Ticker Skeleton ──────────────────────────────────────────────────────── */
function TickerSkeleton() {
  return (
    <div className="bg-accent-red/80">
      <div className="mx-auto flex max-w-7xl items-center px-4 py-2">
        <Skeleton className="h-6 w-20 rounded bg-white/20" />
        <div className="flex-1 ml-3 flex gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-40 bg-white/20" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Hero Skeleton ────────────────────────────────────────────────────────── */
function HeroSkeleton() {
  return (
    <section className="mb-8 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Main slideshow */}
        <div className="lg:col-span-2 min-h-[320px] sm:min-h-[380px] rounded-lg overflow-hidden">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
        {/* Category columns */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="flex-1 min-h-[160px] rounded-lg" />
          <Skeleton className="flex-1 min-h-[160px] rounded-lg" />
        </div>
        <div className="lg:col-span-1 flex flex-col gap-2">
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="flex-1 min-h-[160px] rounded-lg" />
          <Skeleton className="flex-1 min-h-[160px] rounded-lg" />
        </div>
      </div>
      {/* Info row */}
      <div>
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden">
              <Skeleton className="aspect-[16/10] w-full" />
              <div className="p-2.5 space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Topic Cards Skeleton ─────────────────────────────────────────────────── */
function TopicCardsSkeleton() {
  return (
    <section className="mb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card-bg shadow-sm overflow-hidden">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex gap-2.5 px-3 py-2.5">
                <Skeleton className="shrink-0 w-14 h-11 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ── Article Grid Skeleton ────────────────────────────────────────────────── */
function ArticleGridSkeleton() {
  return (
    <div>
      <div className="mb-4 border-b-2 border-accent-red/30 pb-2">
        <Skeleton className="h-6 w-32 mb-1" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card-bg shadow-sm overflow-hidden border-l-3 border-gray-200">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="p-2.5 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex justify-between pt-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sidebar Skeleton ─────────────────────────────────────────────────────── */
function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-card-bg shadow-sm p-4 space-y-3">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ── Main Loading Page ────────────────────────────────────────────────────── */
export default function Loading() {
  return (
    <>
      <TickerSkeleton />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <HeroSkeleton />
        <TopicCardsSkeleton />

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <aside className="lg:col-span-1 order-2 lg:order-1">
            <SidebarSkeleton />
          </aside>
          <div className="lg:col-span-3 order-1 lg:order-2">
            <ArticleGridSkeleton />
          </div>
          <aside className="lg:col-span-1 order-3">
            <SidebarSkeleton />
          </aside>
        </section>
      </main>
    </>
  );
}
