import type { Metadata } from "next";
import Link from "next/link";
import { getVideoPosts, getVideoCategories } from "@/services/api";
import type { VideoPost, VideoCat } from "@/services/api";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "வீடியோக்கள் - ஊரும் உறவும்",
  description: "அனைத்து வீடியோ செய்திகள்",
};

function getEmbedUrl(videoUrl: string): string {
  const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  const dmMatch = videoUrl.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) return `https://www.dailymotion.com/embed/video/${dmMatch[1]}`;
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
  return new Date(d).toLocaleDateString('ta-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function VideoCard({ video }: { video: VideoPost }) {
  const thumb = getThumbnail(video);
  return (
    <Link href={`/videos/${video.slug}`} className="group rounded-2xl bg-card-bg shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-900">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-accent-red/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${video.platform === 'youtube' ? 'bg-red-600' : video.platform === 'vimeo' ? 'bg-blue-500' : 'bg-gray-600'}`}>
            {video.platform.toUpperCase()}
          </span>
          {video.category && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-purple-600">{video.category.name}</span>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-base font-bold leading-snug line-clamp-2 min-h-[2.75rem] group-hover:text-accent-red transition-colors">{video.title}</h3>
        {video.description && <p className="mt-1.5 text-xs text-foreground/50 line-clamp-2">{video.description}</p>}
        <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-foreground/40">
          {fmtDate(video.publishedAt)}
        </div>
      </div>
    </Link>
  );
}

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category: catSlug } = await searchParams;

  let videos: VideoPost[] = [];
  let videoCategories: VideoCat[] = [];
  try { videos = await getVideoPosts(); } catch { /* empty */ }
  try { videoCategories = await getVideoCategories(); } catch { /* empty */ }

  const filteredVideos = catSlug
    ? videos.filter((v) => v.category?.slug === catSlug)
    : videos;

  const activeCat = catSlug ? videoCategories.find((c) => c.slug === catSlug) : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-6 bg-accent-red rounded-full" />
        <h1 className="text-2xl font-bold">{activeCat ? activeCat.name : 'வீடியோக்கள்'}</h1>
        <span className="text-xs text-foreground/40 uppercase tracking-wider ml-1">
          {activeCat ? 'Video Category' : 'All Videos'}
        </span>
      </div>

      {/* Category filter tabs */}
      {videoCategories.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <Link
            href="/videos"
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!catSlug ? 'bg-accent-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            அனைத்தும் ({videos.length})
          </Link>
          {videoCategories.map((c) => {
            const count = videos.filter((v) => v.category?.slug === c.slug).length;
            return (
              <Link
                key={c.id}
                href={`/videos?category=${c.slug}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${catSlug === c.slug ? 'bg-accent-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {c.name} ({count})
              </Link>
            );
          })}
        </div>
      )}

      {/* Video grid */}
      {filteredVideos.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-foreground/60">வீடியோக்கள் இல்லை</p>
      )}
    </main>
  );
}
