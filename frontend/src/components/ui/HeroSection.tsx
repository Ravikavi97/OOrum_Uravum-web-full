'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Article, Category } from '@/services/api';
import { ArticleImage } from '@/components/article/ArticleCard';

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ta-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Fade slideshow ─────────────────────────────────────────────────────────── */
function Slideshow({ articles }: { articles: Article[] }) {
  const [cur, setCur] = useState(0);
  const count = articles.length;
  const goNext = useCallback(() => setCur((c) => (c + 1) % count), [count]);
  const goPrev = useCallback(() => setCur((c) => (c - 1 + count) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(goNext, 6000);
    return () => clearInterval(t);
  }, [count, goNext]);

  if (!count) return null;
  const a = articles[cur];

  return (
    <div className="relative w-full h-full min-h-[320px] sm:min-h-[420px] overflow-hidden rounded-xl bg-gray-900 group">
      {/* All slides stacked, only current visible */}
      {articles.map((art, i) => (
        <div key={art.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === cur ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
          <ArticleImage featuredImage={art.featuredImage} title={art.title}
            categoryName={art.category.name} className="w-full h-full object-cover" />
        </div>
      ))}
      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent z-20 pointer-events-none" />
      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 z-30">
        <Link href={`/category/${a.category.slug}`} className="inline-block rounded-full bg-accent-red px-3 py-0.5 text-[10px] font-bold text-white mb-2">
          {a.category.name}
        </Link>
        <h2 className="text-lg sm:text-2xl font-extrabold text-white leading-snug drop-shadow mt-1">
          <Link href={`/news/${a.slug}`} className="hover:underline underline-offset-2 line-clamp-2">
            {a.title}
          </Link>
        </h2>
        {a.excerpt && (
          <p className="mt-1.5 text-[12px] text-white/70 line-clamp-2 hidden sm:block">{a.excerpt}</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
          <span className="font-semibold text-white/80">{a.author.name}</span>
          <span>·</span>
          <span>{fmtDate(a.publishedAt)}</span>
        </div>
      </div>
      {/* Nav arrows — 44px targets, and always visible on touch devices: they were
          opacity-0 until group-hover, which on a phone (no hover) left no
          reachable way to page through the slideshow at all. */}
      {count > 1 && (
        <>
          <button onClick={goPrev} aria-label="Previous"
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-black/65">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goNext} aria-label="Next"
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-black/65">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {/* Dot strip — the visible dot is 6px, so each is wrapped in a padded
              button that gives a ~44px tall tap target instead. */}
          <div className="absolute bottom-2 right-3 z-30 flex items-center">
            {articles.slice(0, 8).map((_, i) => (
              <button key={i} onClick={() => setCur(i)} aria-label={`Slide ${i + 1}`}
                aria-current={i === cur}
                className="flex h-11 w-6 items-center justify-center">
                <span className={`h-1.5 rounded-full transition-all duration-300 ${i === cur ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
              </button>
            ))}
          </div>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-30">
            <div key={cur} className="h-full bg-accent-red animate-progress-bar" style={{ animationDuration: '6s' }} />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Right-column stacked article list ─────────────────────────────────────── */
function SideList({ articles, catName, catSlug }: { articles: Article[]; catName: string; catSlug: string }) {
  if (!articles.length) return null;
  const [featured, ...rest] = articles;
  return (
    <div className="flex flex-col h-full">
      {/* mini header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 pb-1.5 border-b-2 border-accent-red">
          <span className="w-1 h-4 bg-accent-red rounded-full inline-block" />
          <span className="text-[13px] font-bold">{catName}</span>
        </div>
        <Link href={`/category/${catSlug}`} className="text-[10px] font-bold text-accent-red hover:underline shrink-0">
          அனைத்தும் →
        </Link>
      </div>
      {/* Featured thumbnail */}
      <Link href={`/news/${featured.slug}`}
        className="group relative block rounded-lg overflow-hidden mb-3 aspect-[16/9] bg-gray-100 shrink-0">
        <ArticleImage featuredImage={featured.featuredImage} title={featured.title}
          categoryName={catName} className="group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
          <h3 className="text-[13px] font-bold text-white line-clamp-2 group-hover:underline">{featured.title}</h3>
          <span className="text-[10px] text-white/55 block mt-0.5">{fmtDate(featured.publishedAt)}</span>
        </div>
      </Link>
      {/* Stacked list */}
      <div className="flex flex-col divide-y divide-gray-100 flex-1">
        {rest.slice(0, 3).map((a) => (
          <Link key={a.id} href={`/news/${a.slug}`}
            className="group flex gap-2.5 py-2 hover:bg-gray-50 -mx-1 px-1 rounded transition-colors">
            <div className="shrink-0 w-[68px] h-[50px] rounded overflow-hidden">
              <ArticleImage featuredImage={a.featuredImage} title={a.title}
                categoryName={catName} className="group-hover:scale-105 transition-transform duration-200" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <h4 className="text-[12px] font-semibold line-clamp-2 group-hover:text-accent-red transition-colors">{a.title}</h4>
              <span className="text-[10px] text-foreground/50 block mt-0.5">{fmtDate(a.publishedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Bottom info row: 4 cards ───────────────────────────────────────────────── */
function InfoRow({ title, articles }: { title: string; articles: Article[] }) {
  if (!articles.length) return null;
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b-[3px] border-accent-red">
        <span className="w-1 h-5 bg-accent-red rounded-full" />
        <h3 className="text-[15px] font-extrabold">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {articles.slice(0, 4).map((a) => (
          <Link key={a.id} href={`/news/${a.slug}`}
            className="group bg-card-bg rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
              <ArticleImage featuredImage={a.featuredImage} title={a.title}
                categoryName={a.category.name} className="group-hover:scale-105 transition-transform duration-300" />
              <span className="absolute bottom-1.5 left-1.5 inline-block rounded-full bg-accent-red px-2 py-0.5 text-[9px] font-bold text-white">
                {a.category.name}
              </span>
            </div>
            <div className="p-2.5">
              <h4 className="text-[12px] font-semibold line-clamp-2 group-hover:text-accent-red transition-colors">{a.title}</h4>
              <span className="text-[10px] text-foreground/50 block mt-1">{fmtDate(a.publishedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Hero Section ───────────────────────────────────────────────────────────── */
interface HeroSectionProps {
  sliderArticles: Article[];
  categories: Category[];
  allArticles: Article[];
  heroCategorySlugs: string[];
  infoRowTitle: string;
}

export default function HeroSection({ sliderArticles, categories, allArticles, heroCategorySlugs, infoRowTitle }: HeroSectionProps) {
  const col1Cat = categories.find((c) => c.slug === heroCategorySlugs[0]);
  const col2Cat = categories.find((c) => c.slug === heroCategorySlugs[1]);
  const col1Arts = col1Cat ? allArticles.filter((a) => a.category.slug === col1Cat.slug).slice(0, 4) : [];
  const col2Arts = col2Cat ? allArticles.filter((a) => a.category.slug === col2Cat.slug).slice(0, 4) : [];
  const usedIds = new Set([...sliderArticles.map((a) => a.id), ...col1Arts.map((a) => a.id), ...col2Arts.map((a) => a.id)]);
  const infoArts = allArticles.filter((a) => !usedIds.has(a.id)).slice(0, 4);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b-[3px] border-accent-red">
        <span className="w-1 h-5 bg-accent-red rounded-full" />
        <h2 className="text-[15px] font-extrabold">செய்தி முக்கியம்</h2>
        <span className="text-[10px] text-foreground/40 font-normal ml-1 uppercase tracking-widest">Breaking News</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Big slideshow — 6 cols */}
        <div className="lg:col-span-6">
          <Slideshow articles={sliderArticles} />
        </div>
        {/* Side panel 1 — 3 cols */}
        {col1Cat && col1Arts.length > 0 && (
          <div className="lg:col-span-3 bg-card-bg rounded-xl p-4 shadow-sm">
            <SideList articles={col1Arts} catName={col1Cat.name} catSlug={col1Cat.slug} />
          </div>
        )}
        {/* Side panel 2 — 3 cols */}
        {col2Cat && col2Arts.length > 0 && (
          <div className="lg:col-span-3 bg-card-bg rounded-xl p-4 shadow-sm">
            <SideList articles={col2Arts} catName={col2Cat.name} catSlug={col2Cat.slug} />
          </div>
        )}
      </div>
      <InfoRow title={infoRowTitle} articles={infoArts} />
    </section>
  );
}
