import Link from 'next/link';
import { ArticleImage } from '@/components/article/ArticleCard';

export interface CategoryCardItem {
  id: string;
  name: string;
  slug: string;
  article: {
    title: string;
    href: string;
    excerpt: string;
    image: string | null;
    publishedAt: string | null;
  } | null;
  isObituary?: boolean; // Flag to identify obituary cards
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ta-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function EmptyGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className="h-8 w-8 text-foreground/25"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

/* Every card uses the same media height, title min-height and excerpt min-height so
   cards with and without an article stay identical in size. */
function CategoryCard({ item }: { item: CategoryCardItem }) {
  const { article } = item;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card-bg shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent-red/40 hover:shadow-md">
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-gray-100 sm:h-48">
        {article ? (
          item.isObituary ? (
            // Special handling for obituary images (direct API endpoint)
            <div className="relative h-full w-full">
              {article.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={article.image}
                  alt={article.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-gray-50">
                  <EmptyGlyph />
                </span>
              )}
            </div>
          ) : (
            <ArticleImage
              featuredImage={article.image}
              title={article.title}
              categoryName={item.name}
              className="transition-transform duration-300 group-hover:scale-105"
            />
          )
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gray-50">
            <EmptyGlyph />
          </span>
        )}
        <Link
          href={item.isObituary ? '/obituary' : `/category/${item.slug}`}
          className="absolute left-2.5 top-2.5 max-w-[85%] truncate rounded-full bg-accent-red px-3 py-1 text-[11px] font-bold text-white transition-colors hover:bg-accent-red/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-1"
        >
          {item.name}
        </Link>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {article ? (
          <>
            <Link
              href={article.href}
              className="line-clamp-2 min-h-[3rem] text-[15px] font-bold leading-snug transition-colors hover:text-accent-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
            >
              {article.title}
            </Link>
            <p className="mt-1.5 line-clamp-2 min-h-[2.75rem] text-xs leading-relaxed text-foreground/50">
              {article.excerpt}
            </p>
            <span className="mt-auto block pt-2.5 text-[11px] text-foreground/40">
              {fmtDate(article.publishedAt)}
            </span>
          </>
        ) : (
          <>
            <span className="line-clamp-2 min-h-[3rem] text-[15px] font-bold leading-snug text-foreground/40">
              {item.isObituary ? 'No obituaries yet' : 'No articles yet'}
            </span>
            <p className="mt-1.5 line-clamp-2 min-h-[2.75rem] text-xs leading-relaxed text-foreground/35">
              {item.isObituary ? 'Be the first to submit an obituary' : 'Be the first to publish in this section'}
            </p>
            <span className="mt-auto block pt-2.5 text-[11px] text-foreground/30">&nbsp;</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function CategoryCards({ items = [] }: { items?: CategoryCardItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-6 w-1 rounded-full bg-accent-red" />
        <h2 className="text-xl font-bold">Browse by Category</h2>
        <span className="text-xs uppercase tracking-wider text-foreground/40">Latest in each section</span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <CategoryCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}