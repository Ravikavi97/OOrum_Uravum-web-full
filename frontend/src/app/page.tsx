import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getArticles, getBreakingArticles, getCategories, getSiteSettings,
  getObituaries, getHomeLayout, getHeroConfig, getVideoPosts, getVideoHeroConfig,
  getAdvertisements, getCategoriesWithLatest,
} from '@/services/api';
import type {
  Article, Category, Obituary, HomeLayoutSection, HeroConfig, VideoPost, VideoHeroConfig,
  Advertisement, CategoryWithLatest,
} from '@/services/api';
import ArticleCard, { ArticleImage } from '@/components/article/ArticleCard';
import HeroSection from '@/components/ui/HeroSection';
import VideoHeroSection from '@/components/ui/VideoHeroSection';
import Pagination from '@/components/ui/Pagination';
import ArchiveSidebar from '@/components/ui/ArchiveSidebar';
import AdSidebar from '@/components/ui/AdSidebar';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Divider from '@/components/ui/Divider';
import FeaturedHub from '@/components/ui/FeaturedHub';
import type { HubPost } from '@/components/ui/FeaturedHub';
import SponsoredSidebar from '@/components/ui/SponsoredSidebar';
import CategoryCards from '@/components/ui/CategoryCards';
import type { CategoryCardItem } from '@/components/ui/CategoryCards';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 12;

export async function generateMetadata(): Promise<Metadata> {
  try { const s = await getSiteSettings(); return { title: s.siteTitle || 'OORUM URAVUM', description: s.siteDescription || '' }; }
  catch { return { title: 'OORUM URAVUM' }; }
}
async function safe<T>(fn: () => Promise<T>, fb: T): Promise<T> {
  try { return await fn(); } catch { return fb; }
}

function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ta-IN', { month: 'short', day: 'numeric' });
}

const YT_ID_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function youTubeId(url: string): string | null {
  const m = url?.match(YT_ID_RE);
  return m ? m[1] : null;
}

function videoThumb(v: VideoPost): string | null {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  const id = youTubeId(v.videoUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/* ── Breaking news ticker ──────────────────────────────────────────────────── */
function Ticker({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  return (
    <div className="border-b border-foreground/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-3 py-2">
        <span className="shrink-0 bg-accent-red text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap animate-pulse">🔴 தலையங்கம்</span>
        <div className="overflow-hidden flex-1 h-[1.3rem]">
          <div className="animate-ticker flex gap-10 whitespace-nowrap">
            {[...articles, ...articles].map((a, i) => (
              <Link key={`${a.id}-${i}`} href={`/news/${a.slug}`}
                className="inline-flex items-center gap-1.5 text-[12px] text-foreground/70 hover:text-foreground hover:underline">
                <span className="text-accent-red text-[8px]">◆</span>{a.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable section heading ──────────────────────────────────────────────── */
function SectionHeading({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2 pb-2 border-b-[3px] border-accent-red">
        <span className="w-1 h-5 shrink-0 bg-accent-red rounded-full" />
        <h2 className="min-w-0 text-[15px] font-extrabold leading-none truncate">
          {title}
          {sub && <span className="text-[10px] text-foreground/40 font-normal ml-2 uppercase tracking-widest hidden sm:inline">{sub}</span>}
        </h2>
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-[12px] font-bold text-accent-red hover:underline shrink-0">
          அனைத்தும்
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}

/* ── Per-category section: 1 large left + 4-item right list ───────────────── */
function CategorySection({ cat, articles }: { cat: Category; articles: Article[] }) {
  if (!articles.length) return null;
  const [main, ...rest] = articles;
  return (
    <section className="mb-10">
      <SectionHeading title={cat.name} sub={cat.description || undefined} href={`/category/${cat.slug}`} />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Main featured card — 3 cols */}
        <Link href={`/news/${main.slug}`}
          className="group md:col-span-3 relative block rounded-xl overflow-hidden bg-gray-100 aspect-[16/10] md:aspect-auto md:min-h-[280px]">
          <ArticleImage featuredImage={main.featuredImage} title={main.title}
            categoryName={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <span className="inline-block rounded-full bg-accent-red px-3 py-0.5 text-[10px] font-bold text-white mb-2">{cat.name}</span>
            <h2 className="text-base sm:text-lg font-bold text-white line-clamp-2 group-hover:underline">{main.title}</h2>
            {main.excerpt && <p className="text-[11px] text-white/65 line-clamp-2 mt-1 hidden sm:block">{main.excerpt}</p>}
            <div className="mt-2 text-[10px] text-white/55 flex items-center gap-1.5">
              <span className="font-semibold text-white/70">{main.author.name}</span>
              <span>·</span><span>{fmtDate(main.publishedAt)}</span>
            </div>
          </div>
        </Link>
        {/* Right stacked list — 2 cols */}
        {rest.length > 0 && (
          <div className="md:col-span-2 flex flex-col divide-y divide-gray-100 bg-card-bg rounded-xl overflow-hidden shadow-sm">
            {rest.slice(0, 4).map((a) => (
              <Link key={a.id} href={`/news/${a.slug}`}
                className="group flex gap-3 p-3 hover:bg-gray-50 transition-colors">
                <div className="shrink-0 w-[80px] h-[60px] rounded-lg overflow-hidden">
                  <ArticleImage featuredImage={a.featuredImage} title={a.title}
                    categoryName={cat.name} className="group-hover:scale-105 transition-transform duration-200" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <h3 className="text-[12px] font-semibold line-clamp-2 group-hover:text-accent-red transition-colors">{a.title}</h3>
                  <span className="text-[10px] text-foreground/50 block mt-1">{fmtDate(a.publishedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Obituary strip ────────────────────────────────────────────────────────── */
interface ObitItem {
  id: string; type: 'article' | 'obituary';
  title: string; excerpt: string; image: string; date: string; link: string;
}
function ObitCard({ item }: { item: ObitItem }) {
  return (
    <Link href={item.link}
      className="group bg-card-bg rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        {item.type === 'article'
          ? <ArticleImage featuredImage={item.image || null} title={item.title} categoryName="Obituary"
              className="group-hover:scale-105 transition-transform duration-300" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={item.image} alt={item.title} loading="lazy"
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
        }
      </div>
      <div className="p-2.5 flex-1 flex flex-col">
        <p className="text-[12px] font-semibold line-clamp-2 group-hover:text-accent-red transition-colors">{item.title}</p>
        <span className="text-[10px] text-foreground/50 block mt-auto pt-1.5">{fmtDate(item.date)}</span>
      </div>
    </Link>
  );
}

/* ── Latest news grid ──────────────────────────────────────────────────────── */
function LatestSection({ articles, page, totalPages }: { articles: Article[]; page: number; totalPages: number }) {
  if (!articles.length) return (
    <p className="py-12 text-center text-sm text-foreground/40">இன்னும் செய்திகள் வெளியிடப்படவில்லை.</p>
  );
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((a) => <ArticleCard key={a.id} article={a} small />)}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/" />
    </>
  );
}

/* ── Home page ─────────────────────────────────────────────────────────────── */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pp } = await searchParams;
  const page = Math.max(1, parseInt(pp || '1', 10) || 1);

  const empty     = { data: [] as Article[], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 };
  const emptyObits = { data: [] as Obituary[], total: 0, page: 1, pageSize: 10, totalPages: 0 };

  const [latestRes, heroRes, _brk, cats, obitsRes, layoutSections, heroConfig, videoPosts, videoHeroConfig, sidebarAds, categoryLatest] =
    await Promise.all([
      safe(() => getArticles({ page, pageSize: PAGE_SIZE, status: 'PUBLISHED' }), empty),
      safe(() => getArticles({ page: 1, pageSize: 24, status: 'PUBLISHED' }), empty),
      safe(() => getBreakingArticles(), empty),
      safe(() => getCategories(), [] as Category[]),
      safe(() => getObituaries({ pageSize: 8 }), emptyObits),
      safe(() => getHomeLayout(), [] as HomeLayoutSection[]),
      safe(() => getHeroConfig(), { categorySlugs: [], infoRowTitle: 'தகவல் கண்ணோட்டம்' } as HeroConfig),
      safe(() => getVideoPosts(), [] as VideoPost[]),
      safe(() => getVideoHeroConfig(), { categorySlugs: [], infoRowTitle: 'அனைத்து வீடியோக்கள்' } as VideoHeroConfig),
      safe(() => getAdvertisements('sidebar'), [] as Advertisement[]),
      safe(() => getCategoriesWithLatest(), [] as CategoryWithLatest[]),
    ]);

  const isVisible = (id: string) => {
    if (!layoutSections.length) return true;
    const s = layoutSections.find((x) => x.id === id);
    return s ? s.visible : true;
  };

  const latestArticles = latestRes.data;
  const heroArticles   = heroRes.data;
  const obituaries     = obitsRes.data;

  /* hero category slugs */
  const heroCatSlugs = heroConfig.categorySlugs.length >= 2
    ? heroConfig.categorySlugs
    : cats.filter((c) => !c.parentId && heroArticles.some((a) => a.category.slug === c.slug))
        .slice(0, 2).map((c) => c.slug);

  /* obituary category */
  const obituaryCat = cats.find((c) =>
    c.slug === 'thuyarpakirvoom' || c.name.includes('துயர்') || c.description?.toLowerCase().includes('obituar'));
  const obituaryCatArticles = obituaryCat
    ? heroArticles.filter((a) => a.category.slug === obituaryCat.slug) : [];

  /* per-category articles for CategorySection blocks */
  const catSections = cats
    .filter((c) => !c.parentId)
    .map((c) => ({ cat: c, arts: heroArticles.filter((a) => a.category.slug === c.slug).slice(0, 5) }))
    .filter((x) => x.arts.length > 0);

  /* obituary items */
  const allObits: ObitItem[] = [
    ...obituaryCatArticles.map((a) => ({
      id: a.id, type: 'article' as const,
      title: a.title, excerpt: a.excerpt || '', image: a.featuredImage || '',
      date: a.publishedAt || '', link: `/news/${a.slug}`,
    })),
    ...obituaries.map((o) => ({
      id: o.id, type: 'obituary' as const,
      title: o.name, excerpt: o.content, image:
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/obituaries/${o.id}/image`,
      date: o.publishedAt, link: `/obituary/${o.slug}`,
    })),
  ].slice(0, 8);

  /* latest 2 posts (news + video) for the Featured Hub card */
  const hubPosts: HubPost[] = [
    ...heroArticles.map((a) => ({
      id: `a-${a.id}`,
      kind: 'article' as const,
      title: a.title,
      description: a.excerpt || '',
      href: `/news/${a.slug}`,
      image: a.featuredImage,
      categoryName: a.category?.name || 'செய்தி',
      publishedAt: a.publishedAt || a.createdAt,
      youtubeId: null,
    })),
    ...videoPosts.map((v) => ({
      id: `v-${v.id}`,
      kind: 'video' as const,
      title: v.title,
      description: v.description || '',
      href: `/videos/${v.slug}`,
      image: videoThumb(v),
      categoryName: v.category?.name || 'வீடியோ',
      publishedAt: v.publishedAt,
      youtubeId: youTubeId(v.videoUrl),
    })),
  ]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 2);

  /* one card per category, each with its latest published article (from the API) */
  const categoryCards: CategoryCardItem[] = categoryLatest.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    article: c.article
      ? {
          title: c.article.title,
          href: `/news/${c.article.slug}`,
          excerpt: c.article.excerpt || '',
          image: c.article.featuredImage,
          publishedAt: c.article.publishedAt,
        }
      : null,
  }));

  /* ordered sections */
  const mainIds = ['videoHero', 'ticker', 'hero', 'topicCards', 'obituary', 'latestNews'];
  const orderedSections = (() => {
    if (layoutSections.length) {
      const cfg = layoutSections.filter((s) => mainIds.includes(s.id)).sort((a, b) => a.order - b.order);
      const cfgIds = new Set(cfg.map((s) => s.id));
      const missing = mainIds.filter((id) => !cfgIds.has(id)).map((id, i) => ({ id, label: id, visible: true, order: cfg.length + i }));
      return [...cfg, ...missing];
    }
    return mainIds.map((id, i) => ({ id, label: id, visible: true, order: i }));
  })();

  const showAdSidebar      = isVisible('adSidebar');
  const showArchiveSidebar = isVisible('archiveSidebar');
  const mainColSpan = showAdSidebar && showArchiveSidebar ? 'lg:col-span-3'
    : showAdSidebar || showArchiveSidebar ? 'lg:col-span-4' : 'lg:col-span-5';

  const aboveGrid = ['hero', 'topicCards', 'videoHero'];

  /* section renderer */
  const renderSection = (id: string) => {
    if (!isVisible(id)) return null;
    switch (id) {
      case 'ticker':
        return <Ticker key="ticker" articles={heroArticles.slice(0, 20)} />;

      case 'hero':
        return heroArticles.length ? (
          <HeroSection key="hero"
            sliderArticles={heroArticles.slice(0, 8)}
            categories={cats} allArticles={heroArticles}
            heroCategorySlugs={heroCatSlugs}
            infoRowTitle={heroConfig.infoRowTitle} />
        ) : null;

      case 'videoHero':
        return videoPosts.length ? (
          <VideoHeroSection key="videoHero" videos={videoPosts}
            videoCategorySlugs={videoHeroConfig.categorySlugs}
            videoInfoRowTitle={videoHeroConfig.infoRowTitle} />
        ) : null;

      case 'topicCards':
        return catSections.length ? (
          <div key="topicCards">
            {catSections.map(({ cat, arts }) => (
              <CategorySection key={cat.slug} cat={cat} articles={arts} />
            ))}
          </div>
        ) : null;

      case 'obituary':
        if (!allObits.length) return null;
        return (
          <section key="obituary" className="mb-10">
            <SectionHeading title="இரங்கல் / அஞ்சலி" sub="Obituary · Tributes"
              href={obituaryCat ? `/category/${obituaryCat.slug}` : '/obituary'} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {allObits.map((item) => <ObitCard key={item.id} item={item} />)}
            </div>
          </section>
        );

      case 'latestNews':
        return (
          <div key="latestNews">
            <SectionHeading title="சமீபத்திய செய்திகள்" sub="Latest News" />
            <LatestSection articles={latestArticles} page={page} totalPages={latestRes.totalPages} />
          </div>
        );

      default: return null;
    }
  };

  const tickerSection    = orderedSections.find((s) => s.id === 'ticker');
  const videoHeroSection = orderedSections.find((s) => s.id === 'videoHero');
  const contentSections  = orderedSections.filter((s) => s.id !== 'ticker' && s.id !== 'videoHero');

  return (
    <>
      {/* Ticker — full width above everything */}
      {tickerSection && isVisible('ticker') && <Ticker articles={heroArticles.slice(0, 20)} />}

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb items={[
          { label: 'முகப்பு', href: '/' },
          { label: 'Overview' },
          { label: 'Welcome to Oorum Uravum (ஊரும் உறவும்)' },
        ]} />

        <header className="mb-6">
          <div className="mb-2 flex items-start gap-2">
            <span className="w-1 h-6 shrink-0 bg-accent-red rounded-full" />
            <h1 className="text-xl font-bold sm:text-2xl">Welcome to Oorum Uravum (ஊரும் உறவும்)</h1>
          </div>
          <p className="text-sm text-foreground/60">
            A Portal for Tamil Cultural Heritage, Historical Archives, Obituaries, and Community Documentation
          </p>
        </header>

        {/* Divider between welcome header and the next section */}
        <Divider className="mb-6" />

        {/* Featured Hub + sponsored sidebar */}
        <section aria-label="Featured Hub" className="mb-8">
          <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-10">
            <div className="lg:col-span-2">
              <FeaturedHub posts={hubPosts} />
            </div>
            <div className="lg:col-span-1">
              <SponsoredSidebar ads={sidebarAds} />
            </div>
          </div>

          <CategoryCards items={categoryCards} />
        </section>

        {videoHeroSection && isVisible('videoHero') && videoPosts.length > 0 && (
          <div className="mb-6">
            <VideoHeroSection videos={videoPosts}
              videoCategorySlugs={videoHeroConfig.categorySlugs}
              videoInfoRowTitle={videoHeroConfig.infoRowTitle} />
          </div>
        )}

        {/* Above-grid sections */}
        {contentSections.filter((s) => aboveGrid.includes(s.id)).map((s) => renderSection(s.id))}

        {/* Divider */}
        {latestArticles.length > 0 && <Divider className="my-8" />}

        {/* Sidebar grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {showAdSidebar && (
            <aside className="hidden lg:col-span-1 lg:flex lg:flex-col order-2 lg:order-1 gap-4">
              <AdSidebar />
            </aside>
          )}
          <div className={`order-1 lg:order-2 ${mainColSpan} space-y-6`}>
            {/* Obituary section (inside grid, above latest) */}
            {renderSection('obituary')}
            {/* Latest news */}
            {renderSection('latestNews')}
          </div>
          {showArchiveSidebar && (
            <aside className="hidden lg:col-span-1 lg:flex lg:flex-col order-3 gap-4">
              <ArchiveSidebar />
            </aside>
          )}
        </div>

        {/* Empty state */}
        {!latestArticles.length && !heroArticles.length && (
          <div className="py-24 text-center">
            <div className="inline-flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent-red/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-accent-red/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6V7.5Z" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold">OORUM URAVUM</h1>
              <p className="text-sm text-foreground/50">செய்திகள் விரைவில் வரும்</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
