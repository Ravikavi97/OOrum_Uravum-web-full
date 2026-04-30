import type { Metadata } from "next";
import Link from "next/link";
import { getArticles, getBreakingArticles, getCategories, getSiteSettings, getObituaries, getHomeLayout, getHeroConfig, getVideoPosts, getVideoHeroConfig } from "@/services/api";
import type { Article, Category, Obituary, HomeLayoutSection, HeroConfig, VideoPost, VideoHeroConfig } from "@/services/api";
import ArticleCard, { ArticleImage } from "@/components/article/ArticleCard";
import HeroSection from "@/components/ui/HeroSection";
import VideoHeroSection from "@/components/ui/VideoHeroSection";
import Pagination from "@/components/ui/Pagination";
import ArchiveSidebar from "@/components/ui/ArchiveSidebar";
import AdSidebar from "@/components/ui/AdSidebar";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 12;

export async function generateMetadata(): Promise<Metadata> {
  try { const s = await getSiteSettings(); return { title: s.siteTitle || "OORUM URAVUM", description: s.siteDescription || "" }; }
  catch { return { title: "OORUM URAVUM" }; }
}

async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> { try { return await fn(); } catch { return fb; } }

function Ticker({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  return (
    <div className="overflow-hidden bg-accent-red text-white">
      <div className="mx-auto flex max-w-7xl items-center px-4 py-2 text-sm">
        <span className="shrink-0 rounded bg-white px-3 py-1 text-xs font-bold text-accent-red mr-3">தலையங்கம்</span>
        <div className="overflow-hidden relative flex-1">
          <div className="flex gap-8 whitespace-nowrap animate-ticker">
            {[...articles, ...articles].map((a, i) => (
              <Link key={`${a.id}-${i}`} href={`/news/${a.slug}`} className="hover:underline inline-block">{a.title}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TopicCard({ cat, arts }: { cat: Category; arts: Article[] }) {
  if (!arts.length) return null;
  const first = arts[0];
  const rest = arts.slice(1);
  return (
    <div className="rounded-2xl bg-card-bg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-accent-red px-4 py-2.5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">{cat.name}</h2>
          {cat.description && <span className="text-[10px] text-white/50 uppercase tracking-wider">{cat.description}</span>}
        </div>
        <Link href={`/category/${cat.slug}`} className="text-[10px] text-white/60 hover:text-white transition-colors">View All &rarr;</Link>
      </div>
      <div className="relative">
        <div className="aspect-[16/9] w-full overflow-hidden">
          <ArticleImage featuredImage={first.featuredImage} title={first.title} categoryName={cat.name} className="hover:scale-105 transition-transform duration-300" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight">
            <Link href={`/news/${first.slug}`} className="hover:underline">{first.title}</Link>
          </h3>
          <div className="mt-1 text-[10px] text-white/60">{first.author.name} &middot; {fmtDate(first.publishedAt)}</div>
        </div>
      </div>
      {rest.length > 0 && (
        <div className="divide-y divide-gray-100">
          {rest.map((a) => (
            <div key={a.id} className="flex gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors">
              <div className="shrink-0 w-14 h-11 rounded overflow-hidden">
                <ArticleImage featuredImage={a.featuredImage} title={a.title} categoryName={cat.name} className="hover:scale-110 transition-transform duration-200" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[12px] font-semibold leading-tight line-clamp-2">
                  <Link href={`/news/${a.slug}`} className="hover:text-accent-red transition-colors">{a.title}</Link>
                </h4>
                <span className="text-[10px] text-foreground/40">{fmtDate(a.publishedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pp } = await searchParams;
  const page = Math.max(1, parseInt(pp || "1", 10) || 1);
  const empty = { data: [] as Article[], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 };
  const emptyObits = { data: [] as Obituary[], total: 0, page: 1, pageSize: 10, totalPages: 0 };

  // Always fetch page-1 data for hero/topics + paginated data for Latest News grid
  const [latestRes, heroRes, brk, cats, obitsRes, layoutSections, heroConfig, videoPosts, videoHeroConfig] = await Promise.all([
    safe(() => getArticles({ page, pageSize: PAGE_SIZE, status: "PUBLISHED" }), empty),
    safe(() => getArticles({ page: 1, pageSize: 20, status: "PUBLISHED" }), empty),
    safe(() => getBreakingArticles(), empty),
    safe(() => getCategories(), [] as Category[]),
    safe(() => getObituaries({ pageSize: 6 }), emptyObits),
    safe(() => getHomeLayout(), [] as HomeLayoutSection[]),
    safe(() => getHeroConfig(), { categorySlugs: [], infoRowTitle: 'தகவல் கண்ணோட்டம்' } as HeroConfig),
    safe(() => getVideoPosts(), [] as VideoPost[]),
    safe(() => getVideoHeroConfig(), { categorySlugs: [], infoRowTitle: 'அனைத்து வீடியோக்கள்' } as VideoHeroConfig),
  ]);

  // Helper to check if a section is visible (default: visible if no config)
  const isVisible = (sectionId: string) => {
    if (layoutSections.length === 0) return true;
    const section = layoutSections.find((s) => s.id === sectionId);
    return section ? section.visible : true;
  };

  const latestArticles = latestRes.data;
  const heroArticles = heroRes.data;
  const obituaries = obitsRes.data;

  // Hero category slugs: from CMS config or auto-pick first 2 categories with articles
  const heroCatSlugs = heroConfig.categorySlugs.length >= 2
    ? heroConfig.categorySlugs
    : cats.filter((c) => !c.parentId && heroArticles.some((a) => a.category.slug === c.slug)).slice(0, 2).map((c) => c.slug);

  // Find the obituary/tribute category to combine with standalone obituaries
  const obituaryCat = cats.find((c) => c.slug === 'thuyarpakirvoom' || c.name.includes('துயர்') || c.description?.toLowerCase().includes('obituar'));
  const obituaryCatArticles = obituaryCat
    ? heroArticles.filter((a) => a.category.slug === obituaryCat.slug)
    : [];

  // Topic cards always use page-1 articles
  const topicCards: { cat: Category; arts: Article[] }[] = [];
  for (const c of cats) {
    const a = heroArticles.filter((x) => x.category.slug === c.slug).slice(0, 4);
    if (a.length) topicCards.push({ cat: c, arts: a });
  }

  // Build ordered list of main sections (excluding sidebars which are structural)
  const mainSectionIds = ['videoHero', 'ticker', 'hero', 'obituary', 'topicCards', 'latestNews'];
  let orderedSections: { id: string; label: string; visible: boolean; order: number }[];
  if (layoutSections.length > 0) {
    const configured = layoutSections.filter((s) => mainSectionIds.includes(s.id)).sort((a, b) => a.order - b.order);
    // Add any missing main sections (e.g. videoHero) that aren't in the saved config yet
    const configuredIds = new Set(configured.map((s) => s.id));
    const missing = mainSectionIds
      .filter((id) => !configuredIds.has(id))
      .map((id, i) => ({ id, label: id, visible: true, order: configured.length + i }));
    orderedSections = [...configured, ...missing];
  } else {
    orderedSections = mainSectionIds.map((id, i) => ({ id, label: id, visible: true, order: i }));
  }

  // Section renderers
  const renderSection = (sectionId: string) => {
    if (!isVisible(sectionId)) return null;
    switch (sectionId) {
      case 'ticker':
        return <Ticker key="ticker" articles={heroArticles.slice(0, 20)} />;
      case 'hero':
        return heroArticles.length > 0 ? (
          <HeroSection
            key="hero"
            sliderArticles={heroArticles.slice(0, 8)}
            categories={cats}
            allArticles={heroArticles}
            heroCategorySlugs={heroCatSlugs}
            infoRowTitle={heroConfig.infoRowTitle}
          />
        ) : null;
      case 'videoHero':
        return videoPosts.length > 0 ? (
          <VideoHeroSection
            key="videoHero"
            videos={videoPosts}
            videoCategorySlugs={videoHeroConfig.categorySlugs}
            videoInfoRowTitle={videoHeroConfig.infoRowTitle}
          />
        ) : null;
      case 'topicCards':
        return topicCards.length > 0 ? (
          <section key="topicCards" className="mb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {topicCards.map((b) => <TopicCard key={b.cat.slug} cat={b.cat} arts={b.arts} />)}
          </section>
        ) : null;
      case 'latestNews':
        return (
          <div key="latestNews">
            <div className="mb-4 border-b-2 border-accent-red pb-2">
              <h2 className="text-lg font-bold">Latest News</h2>
              <span className="text-[11px] text-foreground/40 uppercase tracking-wide">All Recent Articles</span>
            </div>
            {latestArticles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {latestArticles.map((a) => <ArticleCard key={a.id} article={a} small />)}
                </div>
                <Pagination currentPage={page} totalPages={latestRes.totalPages} basePath="/" />
              </>
            ) : (
              <p className="text-sm text-foreground/40 py-8 text-center">No articles published yet.</p>
            )}
          </div>
        );
      case 'obituary': {
        // Combine category articles + standalone obituaries, take latest 6
        const allObits: { type: 'article' | 'obituary'; id: string; title: string; excerpt: string; image: string; date: string; link: string; author?: string }[] = [];
        for (const a of obituaryCatArticles) {
          allObits.push({ type: 'article', id: a.id, title: a.title, excerpt: a.excerpt || a.content, image: a.featuredImage || '', date: a.publishedAt || '', link: `/news/${a.slug}`, author: a.author.name });
        }
        for (const o of obituaries) {
          allObits.push({ type: 'obituary', id: o.id, title: o.name, excerpt: o.content, image: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/obituaries/${o.id}/image`, date: o.publishedAt, link: `/obituary/${o.slug}` });
        }
        const displayObits = allObits.slice(0, 6);
        if (!displayObits.length) return null;

        return (
          <section key="obituary" className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-accent-red rounded-full" />
                <h2 className="text-base font-bold">இரங்கல் / அஞ்சலி</h2>
                <span className="text-[10px] text-foreground/40 uppercase tracking-wider ml-1">Obituary / Tributes</span>
              </div>
              {obituaryCat && (
                <Link href={`/category/${obituaryCat.slug}`} className="text-xs text-accent-red hover:underline">View All →</Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayObits.map((item) => (
                <Link key={item.id} href={item.link} className="group rounded-xl bg-card-bg shadow-sm overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="relative w-full overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.type === 'article' ? (
                      <ArticleImage featuredImage={item.image || null} title={item.title} categoryName="Obituary" className="group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <img src={item.image} alt={item.title} className="w-full h-auto object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold leading-tight line-clamp-2">{item.title}</p>
                    <p className="text-[10px] text-foreground/50 mt-1.5">{fmtDate(item.date)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      }
      default:
        return null;
    }
  };

  // Split: ticker renders outside main, videoHero before ticker, rest inside
  const tickerOrder = orderedSections.find((s) => s.id === 'ticker');
  const videoHeroOrder = orderedSections.find((s) => s.id === 'videoHero');
  const contentSections = orderedSections.filter((s) => s.id !== 'ticker' && s.id !== 'videoHero');

  return (
    <>
      {tickerOrder && isVisible('ticker') && <Ticker articles={heroArticles.slice(0, 20)} />}
      {videoHeroOrder && isVisible('videoHero') && videoPosts.length > 0 && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <VideoHeroSection videos={videoPosts} />
        </div>
      )}
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Render main sections in configured order (hero, topicCards before the grid) */}
        {contentSections.filter((s) => s.id === 'hero' || s.id === 'obituary' || s.id === 'topicCards' || s.id === 'videoHero').map((s) => renderSection(s.id))}

        {/* Grid: sidebars + remaining content sections */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {isVisible('adSidebar') && (
          <aside className="lg:col-span-1 order-2 lg:order-1 flex flex-col gap-4">
            <AdSidebar />
          </aside>
          )}

          <div className={`order-1 lg:order-2 ${isVisible('adSidebar') && isVisible('archiveSidebar') ? 'lg:col-span-3' : isVisible('adSidebar') || isVisible('archiveSidebar') ? 'lg:col-span-4' : 'lg:col-span-5'}`}>
            {/* Render latestNews and obituary in configured order */}
            {contentSections.filter((s) => s.id !== 'hero' && s.id !== 'topicCards' && s.id !== 'videoHero' && s.id !== 'obituary').map((s) => renderSection(s.id))}
          </div>

          {isVisible('archiveSidebar') && (
          <aside className="lg:col-span-1 order-3 lg:order-3 flex flex-col gap-4">
            <ArchiveSidebar />
          </aside>
          )}
        </section>

        {!latestArticles.length && (
          <div className="py-20 text-center"><h1 className="text-3xl font-bold">OORUM URAVUM</h1></div>
        )}
      </main>
    </>
  );
}
