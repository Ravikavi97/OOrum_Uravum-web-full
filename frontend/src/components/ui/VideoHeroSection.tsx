'use client';

import { useState, useEffect, useCallback } from 'react';
import type { VideoPost } from '@/services/api';

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function getEmbedUrl(videoUrl: string, autoplay = true): string {
  const params = autoplay ? 'autoplay=1&mute=1&loop=1&playsinline=1&controls=0&showinfo=0&rel=0' : '';
  const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}${params ? '?' + params : ''}`;
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}${params ? '?' + params.replace('mute=1', 'muted=1') : ''}`;
  const dmMatch = videoUrl.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) return `https://www.dailymotion.com/embed/video/${dmMatch[1]}${params ? '?' + params : ''}`;
  return videoUrl;
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getPlatformIcon(platform: string): string {
  switch (platform) {
    case 'youtube': return '▶';
    case 'vimeo': return '▷';
    case 'dailymotion': return '▸';
    default: return '▶';
  }
}

/* ── Trailer Embed (autoplay muted for all video cards) ─────────────────── */

function TrailerEmbed({ video, className = '' }: { video: VideoPost; className?: string }) {
  return (
    <iframe
      src={getEmbedUrl(video.videoUrl, true)}
      className={`w-full h-full ${className}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title={video.title}
      loading="lazy"
    />
  );
}

/* ── Main Slideshow (auto-advances every 15s) ───────────────────────────── */

function VideoSlideshow({ videos }: { videos: VideoPost[] }) {
  const [current, setCurrent] = useState(0);
  const count = videos.length;
  const next = useCallback(() => setCurrent((c) => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + count) % count), [count]);

  // Auto-advance every 15 seconds
  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(next, 15000);
    return () => clearInterval(t);
  }, [count, next]);

  if (!count) return null;
  const v = videos[current];

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-gray-900">
      <TrailerEmbed key={v.id} video={v} className="absolute inset-0" />
      {/* Title overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none">
        <div className="flex gap-1.5 flex-wrap">
          <span className="inline-block rounded bg-accent-red px-2 py-0.5 text-[10px] font-bold text-white">
            {getPlatformIcon(v.platform)} {v.platform.toUpperCase()}
          </span>
          {v.category && (
            <span className="inline-block rounded bg-white/20 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
              {v.category.name}
            </span>
          )}
        </div>
        <h2 className="mt-1.5 text-lg sm:text-xl font-bold text-white leading-snug line-clamp-2">{v.title}</h2>
        <p className="mt-1 text-[11px] text-white/60">{fmtDate(v.publishedAt)}</p>
      </div>
      {/* Slide counter */}
      {count > 1 && (
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <span className="bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded">{current + 1}/{count}</span>
        </div>
      )}
      {/* Navigation arrows */}
      {count > 1 && (
        <div className="absolute top-3 right-3 flex gap-1 z-10">
          <button onClick={prev} className="flex h-7 w-7 items-center justify-center rounded bg-white/20 text-white hover:bg-white/40 transition-colors" aria-label="Previous">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={next} className="flex h-7 w-7 items-center justify-center rounded bg-white/20 text-white hover:bg-white/40 transition-colors" aria-label="Next">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
      {/* Progress bar */}
      {count > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-10">
          <div className="h-full bg-accent-red transition-all duration-300" style={{ width: `${((current + 1) / count) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/* ── Side Video Card (plays as trailer) ─────────────────────────────────── */

function VideoCard({ video }: { video: VideoPost }) {
  return (
    <div className="flex-1 relative overflow-hidden rounded-lg bg-gray-900 min-h-[140px] sm:min-h-0">
      <TrailerEmbed video={video} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5 pointer-events-none">
        <div className="flex gap-1 mb-1">
          <span className="rounded bg-accent-red/90 px-1.5 py-0.5 text-[9px] font-bold text-white">{video.platform.toUpperCase()}</span>
          {video.category && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white">{video.category.name}</span>
          )}
        </div>
        <h4 className="text-[12px] font-bold text-white leading-tight line-clamp-2">{video.title}</h4>
        <p className="mt-0.5 text-[10px] text-white/60">{fmtDate(video.publishedAt)}</p>
      </div>
    </div>
  );
}

/* ── Info Row (plays as trailers) ───────────────────────────────────────── */

function VideoInfoRow({ videos }: { videos: VideoPost[] }) {
  if (!videos.length) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {videos.slice(0, 4).map((v) => (
        <div key={v.id} className="overflow-hidden rounded-lg bg-gray-900">
          <div className="relative aspect-[16/10] overflow-hidden">
            <TrailerEmbed video={v} className="absolute inset-0" />
            <div className="absolute bottom-1.5 left-1.5 pointer-events-none">
              <span className="rounded bg-accent-red/90 px-1.5 py-0.5 text-[9px] font-bold text-white">{v.platform.toUpperCase()}</span>
            </div>
          </div>
          <div className="p-2.5 bg-card-bg">
            <h4 className="text-[12px] font-bold leading-tight line-clamp-2">{v.title}</h4>
            <p className="mt-1 text-[10px] text-foreground/40">{fmtDate(v.publishedAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Video Hero Section ────────────────────────────────────────────── */

interface VideoHeroSectionProps {
  videos: VideoPost[];
  videoCategorySlugs?: string[];
  videoInfoRowTitle?: string;
}

export default function VideoHeroSection({ videos, videoCategorySlugs = [], videoInfoRowTitle = 'அனைத்து வீடியோக்கள்' }: VideoHeroSectionProps) {
  if (!videos.length) return null;

  const col1Videos = videoCategorySlugs[0]
    ? videos.filter((v) => v.category?.slug === videoCategorySlugs[0]).slice(0, 2)
    : videos.slice(0, 2);
  const col2Videos = videoCategorySlugs[1]
    ? videos.filter((v) => v.category?.slug === videoCategorySlugs[1]).slice(0, 2)
    : videos.slice(2, 4);

  const col1Label = videoCategorySlugs[0]
    ? (col1Videos[0]?.category?.name || 'சமீபத்திய வீடியோ')
    : 'சமீபத்திய வீடியோ';
  const col2Label = videoCategorySlugs[1]
    ? (col2Videos[0]?.category?.name || 'மேலும் வீடியோ')
    : 'மேலும் வீடியோ';

  const sliderVideos = videos.slice(0, 8);
  const usedIds = new Set([...col1Videos.map((v) => v.id), ...col2Videos.map((v) => v.id)]);
  const infoVideos = videos.filter((v) => !usedIds.has(v.id)).slice(0, 4);

  return (
    <section className="mb-8 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-5 bg-accent-red rounded-full" />
        <h2 className="text-base font-bold">வீடியோ செய்திகள்</h2>
        <span className="text-[10px] text-foreground/40 uppercase tracking-wider ml-1">Video News</span>
      </div>

      {/* Row 1: Video Slider + 2 side columns */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2 min-h-[320px] sm:min-h-[380px]">
          <VideoSlideshow videos={sliderVideos} />
        </div>
        {col1Videos.length > 0 && (
          <div className="lg:col-span-1 flex flex-col gap-2">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <span className="w-1 h-4 bg-accent-red rounded-full" />
              {col1Label}
            </h3>
            <div className="flex flex-col gap-2 flex-1">
              {col1Videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </div>
        )}
        {col2Videos.length > 0 && (
          <div className="lg:col-span-1 flex flex-col gap-2">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <span className="w-1 h-4 bg-accent-red rounded-full" />
              {col2Label}
            </h3>
            <div className="flex flex-col gap-2 flex-1">
              {col2Videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Info row */}
      {infoVideos.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <span className="w-1 h-4 bg-accent-red rounded-full" />
            {videoInfoRowTitle}
          </h3>
          <VideoInfoRow videos={infoVideos} />
        </div>
      )}
    </section>
  );
}
