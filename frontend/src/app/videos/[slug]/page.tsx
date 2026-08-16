import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVideoBySlug, getVideoPosts, ApiRequestError } from "@/services/api";
import type { VideoPost } from "@/services/api";
import ShareButtons from "@/components/ui/ShareButtons";

export const revalidate = 10;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function getEmbedUrl(videoUrl: string): string {
  const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  const dmMatch = videoUrl.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) return `https://www.dailymotion.com/embed/video/${dmMatch[1]}?autoplay=1`;
  return videoUrl;
}

function getThumbnail(video: VideoPost): string {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  const ytMatch = video.videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  return '';
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ta-IN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const video = await getVideoBySlug(slug);
    return {
      title: `${video.title} - ஊரும் உறவும்`,
      description: video.description || video.title,
      openGraph: {
        title: video.title,
        description: video.description || video.title,
        url: `${SITE_URL}/videos/${slug}`,
        type: 'video.other',
        images: video.thumbnailUrl ? [video.thumbnailUrl] : undefined,
      },
    };
  } catch {
    return { title: 'வீடியோ' };
  }
}

function RelatedVideoCard({ video }: { video: VideoPost }) {
  const thumb = getThumbnail(video);
  return (
    <Link href={`/videos/${video.slug}`} className="group flex gap-3 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 px-2 rounded transition-colors">
      <div className="shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-gray-900 relative">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
            <span className="text-xl">🎬</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-accent-red/80 flex items-center justify-center">
            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold leading-tight line-clamp-2 group-hover:text-accent-red transition-colors">{video.title}</h4>
        {video.category && (
          <span className="inline-block mt-1 text-[10px] text-purple-600 font-medium">{video.category.name}</span>
        )}
        <p className="text-[10px] text-foreground/40 mt-1">{fmtDate(video.publishedAt)}</p>
      </div>
    </Link>
  );
}

export default async function VideoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let video: VideoPost;
  try {
    video = await getVideoBySlug(slug);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) notFound();
    notFound();
  }

  let allVideos: VideoPost[] = [];
  try { allVideos = await getVideoPosts(); } catch { /* empty */ }

  const related = [
    ...allVideos.filter((v) => v.id !== video.id && v.category?.slug === video.category?.slug),
    ...allVideos.filter((v) => v.id !== video.id && v.category?.slug !== video.category?.slug),
  ].slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-sm text-foreground/50 mb-4">
        <Link href="/" className="hover:text-accent-red">முகப்பு</Link>
        <span>/</span>
        <Link href="/videos" className="hover:text-accent-red">வீடியோக்கள்</Link>
        {video.category && (
          <>
            <span>/</span>
            <Link href={`/videos?category=${video.category.slug}`} className="hover:text-accent-red">{video.category.name}</Link>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-gray-900 shadow-lg">
            <iframe
              src={getEmbedUrl(video.videoUrl)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          </div>

          <div className="mt-4">
            <div className="flex gap-2 flex-wrap mb-2">
              {video.category && (
                <Link href={`/videos?category=${video.category.slug}`} className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">
                  {video.category.name}
                </Link>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${video.platform === 'youtube' ? 'bg-red-600' : video.platform === 'vimeo' ? 'bg-blue-500' : 'bg-gray-600'}`}>
                {video.platform.toUpperCase()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{video.title}</h1>
            <div className="mt-2 text-sm text-foreground/50">
              <time dateTime={video.publishedAt}>{fmtDate(video.publishedAt)}</time>
            </div>

            {video.description && (
              <div className="mt-4 p-4 bg-card-bg rounded-xl border border-gray-100">
                <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line">{video.description}</p>
              </div>
            )}

            {/* Share buttons */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <ShareButtons
                url={`${SITE_URL}/videos/${video.slug}`}
                title={video.title}
                description={video.description || undefined}
              />
            </div>

            {/* Share buttons */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <ShareButtons
                url={`${SITE_URL}/videos/${video.slug}`}
                title={video.title}
                description={video.description || undefined}
              />
            </div>
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="bg-card-bg rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
              <span className="w-1 h-4 bg-accent-red rounded-full" />
              தொடர்புடைய வீடியோக்கள்
            </h3>
            {related.length > 0 ? (
              <div className="flex flex-col">
                {related.map((v) => <RelatedVideoCard key={v.id} video={v} />)}
              </div>
            ) : (
              <p className="text-xs text-foreground/40 text-center py-4">வேறு வீடியோக்கள் இல்லை</p>
            )}
            <Link href="/videos" className="block mt-3 text-center text-xs text-accent-red hover:underline font-medium">
              அனைத்து வீடியோக்களையும் காண →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
