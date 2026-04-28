import Link from "next/link";
import type { Article } from "@/services/api";

// ─── Gradient colors per category ────────────────────────────────────────────

const COLORS = [
  { bg: "bg-gradient-to-br from-orange-500 to-red-600", border: "border-orange-400" },
  { bg: "bg-gradient-to-br from-blue-500 to-indigo-600", border: "border-blue-400" },
  { bg: "bg-gradient-to-br from-emerald-500 to-teal-600", border: "border-emerald-400" },
  { bg: "bg-gradient-to-br from-purple-500 to-fuchsia-600", border: "border-purple-400" },
  { bg: "bg-gradient-to-br from-rose-500 to-pink-600", border: "border-rose-400" },
  { bg: "bg-gradient-to-br from-amber-500 to-yellow-600", border: "border-amber-400" },
];

function pick(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function ArticleImage({ featuredImage, title, categoryName, className = "" }: {
  featuredImage: string | null; title: string; categoryName: string; className?: string;
}) {
  if (featuredImage && (featuredImage.startsWith("data:") || featuredImage.startsWith("http"))) {
    return <img src={featuredImage} alt={title} className={`h-full w-full object-cover ${className}`} loading="lazy" />;
  }
  const c = pick(categoryName);
  return (
    <div className={`h-full w-full flex flex-col items-center justify-center gap-2 ${c.bg}`}>
      <svg className="w-10 h-10 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
      <span className="text-white/70 text-xs font-medium px-3 text-center">{categoryName}</span>
    </div>
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ta-IN", { year: "numeric", month: "short", day: "numeric" });
}

function archiveHref(d: string | null): string {
  if (!d) return "/";
  const date = new Date(d);
  return `/archive/${date.getFullYear()}/${date.getMonth() + 1}`;
}

function DateLink({ dt }: { dt: string | null }) {
  if (!dt) return null;
  return (
    <Link href={archiveHref(dt)} className="hover:text-accent-red hover:underline transition-colors">
      <time dateTime={dt}>{fmtDate(dt)}</time>
    </Link>
  );
}

interface Props { article: Article; featured?: boolean; compact?: boolean; small?: boolean; }

export default function ArticleCard({ article, featured, compact, small }: Props) {
  const dt = article.publishedAt ?? article.createdAt;
  const color = pick(article.category.name);

  // ── Small: compact grid card for bottom sections ──
  if (small) {
    return (
      <article className={`group overflow-hidden rounded-xl bg-card-bg border-l-3 ${color.border} shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}>
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <ArticleImage featuredImage={article.featuredImage} title={article.title} categoryName={article.category.name} className="transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute top-2 left-2">
            <Link href={`/category/${article.category.slug}`} className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-700 shadow-sm">{article.category.name}</Link>
          </div>
        </div>
        <div className="p-2.5">
          <h3 className="text-[13px] font-bold leading-tight line-clamp-2">
            <Link href={`/news/${article.slug}`} className="hover:text-accent-red transition-colors">{article.title}</Link>
          </h3>
          {(article.excerpt || article.content) && (
            <p className="mt-1 text-[11px] text-foreground/50 line-clamp-2 leading-relaxed">
              {article.excerpt || article.content}
            </p>
          )}
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-foreground/40">
            <span className="font-medium text-foreground/50 truncate">{article.author.name}</span>
            <DateLink dt={dt} />
          </div>
        </div>
      </article>
    );
  }

  // ── Compact: sidebar mini card ──
  if (compact) {
    return (
      <article className="group flex gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
        <div className="shrink-0 w-[68px] h-[52px] rounded-lg overflow-hidden">
          <ArticleImage featuredImage={article.featuredImage} title={article.title} categoryName={article.category.name} className="group-hover:scale-110 transition-transform duration-300" />
        </div>
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <h4 className="text-[13px] font-bold leading-tight line-clamp-2">
            <Link href={`/news/${article.slug}`} className="hover:text-accent-red transition-colors">{article.title}</Link>
          </h4>
          <DateLink dt={dt} />
        </div>
      </article>
    );
  }

  // ── Featured: large hero card with overlay text ──
  if (featured) {
    return (
      <article className="group relative overflow-hidden rounded-2xl shadow-lg">
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <ArticleImage featuredImage={article.featuredImage} title={article.title} categoryName={article.category.name} className="transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {article.isBreaking && (
            <span className="absolute top-4 left-4 rounded-full bg-accent-red px-3 py-1 text-xs font-bold text-white shadow-lg animate-pulse">🔴 முக்கிய செய்தி</span>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
            <Link href={`/category/${article.category.slug}`} className="inline-block rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white border border-white/30">{article.category.name}</Link>
            <h3 className="mt-2 text-lg sm:text-2xl font-bold text-white leading-snug line-clamp-2 drop-shadow-lg">
              <Link href={`/news/${article.slug}`} className="hover:underline">{article.title}</Link>
            </h3>
            {article.excerpt && <p className="mt-1.5 text-sm text-white/70 line-clamp-2 hidden sm:block">{article.excerpt}</p>}
            <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
              <span className="font-medium text-white/70">{article.author.name}</span>
              <span>·</span>
              <DateLink dt={dt} />
            </div>
          </div>
        </div>
      </article>
    );
  }

  // ── Default: vertical grid card ──
  return (
    <article className={`group overflow-hidden rounded-2xl bg-card-bg border-b-4 ${color.border} shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <ArticleImage featuredImage={article.featuredImage} title={article.title} categoryName={article.category.name} className="transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute top-3 left-3">
          <Link href={`/category/${article.category.slug}`} className="rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow-sm hover:bg-white transition-colors">{article.category.name}</Link>
        </div>
        {article.isBreaking && (
          <span className="absolute top-3 right-3 rounded-full bg-accent-red px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-base font-bold leading-snug line-clamp-2 min-h-[2.75rem]">
          <Link href={`/news/${article.slug}`} className="hover:text-accent-red transition-colors">{article.title}</Link>
        </h3>
        {article.excerpt && <p className="mt-1.5 text-xs text-foreground/50 line-clamp-2">{article.excerpt}</p>}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-foreground/40">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500">
              {article.author.name.charAt(0)}
            </div>
            <span className="font-medium text-foreground/60">{article.author.name}</span>
          </div>
          <DateLink dt={dt} />
        </div>
      </div>
    </article>
  );
}
