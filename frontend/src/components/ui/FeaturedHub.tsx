'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface HubPost {
  id: string;
  kind: 'article' | 'video';
  title: string;
  description: string;
  href: string;
  image: string | null;
  categoryName: string;
  publishedAt: string | null;
  youtubeId?: string | null;
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ta-IN', { month: 'short', day: 'numeric' });
}

function PlayGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ImageGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className="h-8 w-8 text-white/30"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 012.909 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0021.75 18.75V5.25A2.25 2.25 0 0019.5 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
      />
    </svg>
  );
}

function FallbackTile({ label }: { label: string }) {
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-primary-dark px-3 text-center">
      <ImageGlyph />
      <span className="line-clamp-2 text-[11px] font-semibold text-white/50">{label}</span>
    </span>
  );
}

function HubPostCard({ post }: { post: HubPost }) {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const isPlayable = Boolean(post.youtubeId);
  const showImage = Boolean(post.image) && !thumbFailed;

  const media = showImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={post.image as string}
      alt={post.title}
      loading="lazy"
      onError={() => setThumbFailed(true)}
      className="h-full w-full object-cover"
    />
  ) : (
    <FallbackTile label={post.categoryName} />
  );

  return (
    <article className="group flex flex-col rounded-2xl border border-white/10 bg-primary-dark p-4 transition-colors hover:border-accent-red/50">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/45">
        {isPlayable && playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${post.youtubeId}?autoplay=1`}
            title={post.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : isPlayable ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${post.title}`}
            className="absolute inset-0 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
          >
            {media}
            <span className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/50" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-red text-white shadow-lg transition-transform group-hover:scale-110">
                <PlayGlyph className="h-6 w-6 translate-x-0.5" />
              </span>
            </span>
          </button>
        ) : (
          <Link
            href={post.href}
            className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
          >
            {media}
            <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/40" />
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="max-w-full truncate rounded-full bg-accent-red/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-red">
          {post.categoryName}
        </span>
        {fmtDate(post.publishedAt) && (
          <span className="shrink-0 text-[10px] text-white/40">{fmtDate(post.publishedAt)}</span>
        )}
      </div>

      <h4 className="mt-2 line-clamp-2 text-lg font-bold leading-snug sm:text-xl">
        <Link
          href={post.href}
          className="text-white transition-colors hover:text-accent-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
        >
          {post.title}
        </Link>
      </h4>

      {post.description && (
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-white/60">
          {post.description}
        </p>
      )}
    </article>
  );
}

export default function FeaturedHub({ posts = [] }: { posts?: HubPost[] }) {
  return (
    // Padding steps down on phones: 32px of shell padding plus the inner card's
    // own padding left only ~232px of usable width inside a 360px screen.
    <div className="rounded-3xl border border-white/10 bg-hub-gradient p-4 shadow-lg sm:p-6 lg:p-10">
      <span className="inline-block rounded-full bg-accent-red px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white">
        Featured Hub
      </span>

      <h2 className="mt-5 text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">
        தமிழ் நாகரிகம், பண்பாடு மற்றும் வரலாறு
      </h2>

      <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
        Explore centuries of rich Tamil literature, sovereign kingdoms, ancient architecture,
        community tribes, and documentary archives preserving the legacy of Tamil people
        worldwide.
      </p>

      {posts.length > 0 && (
        <>
          <div className="my-7 h-px w-full bg-white/15" aria-hidden="true" />

          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-accent-red">
            <span className="h-2 w-2 rounded-full bg-accent-red" aria-hidden="true" />
            Latest Update
          </h3>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {posts.map((post) => (
              <HubPostCard key={post.id} post={post} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}