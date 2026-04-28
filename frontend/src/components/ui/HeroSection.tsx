'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Article, Category } from '@/services/api';
import { ArticleImage } from '@/components/article/ArticleCard';

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Slideshow ──────────────────────────────────────────────────────────────── */

function Slideshow({ articles }: { articles: Article[] }) {
  const [current, setCurrent] = useState(0);
  const count = articles.length;
  const next = useCallback(() => setCurrent((c) => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + count) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [count, next]);

  if (!count) return null;
  const a = articles[current];

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-gray-900">
      <div className="absolute inset-0">
        <ArticleImage featuredImage={a.featuredImage} title={a.title} categoryName={a.category.name} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
        <Link href={`/category/${a.category.slug}`} className="inline-block rounded bg-accent-red px-2 py-0.5 text-[10px] font-bold text-white">{a.category.name}</Link>
        <h2 className="mt-1.5 text-lg sm:text-xl font-bold text-white leading-snug line-clamp-2">
          <Link href={`/news/${a.slug}`} className="hover:underline">{a.title}</Link>
        </h2>
        <p className="mt-1 text-[11px] text-white/60">{fmtDate(a.publishedAt)} / {a.author.name}</p>
      </div>
      {count > 1 && (
        <>
          <div className="absolute top-3 right-3 flex gap-1">
            <button onClick={prev} className="flex h-7 w-7 items-center justify-center rounded bg-white/20 text-white hover:bg-white/40 transition-colors" aria-label="Previous">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={next} className="flex h-7 w-7 items-center justify-center rounded bg-white/20 text-white hover:bg-white/40 transition-colors" aria-label="Next">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Category Column (2 stacked article cards) ──────────────────────────────── */

function CategoryColumn({ category, articles }: { category: Category; articles: Article[] }) {
  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
        <span className="w-1 h-4 bg-accent-red rounded-full" />
        {category.name}
      </h3>
      <div className="flex flex-col gap-2 flex-1">
        {articles.slice(0, 2).map((a) => (
          <Link key={a.id} href={`/news/${a.slug}`} className="group flex-1 relative overflow-hidden rounded-lg bg-gray-100 min-h-[180px] sm:min-h-0">
            <div className="absolute inset-0">
              <ArticleImage featuredImage={a.featuredImage} title={a.title} categoryName={a.category.name} className="group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="flex gap-1 mb-1">
                <span className="rounded bg-accent-red/90 px-1.5 py-0.5 text-[9px] font-bold text-white">{a.category.name}</span>
              </div>
              <h4 className="text-[13px] font-bold text-white leading-tight line-clamp-2">{a.title}</h4>
              <p className="mt-0.5 text-[10px] text-white/60">{fmtDate(a.publishedAt)} / {a.author.name}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Info Row (4 article cards) ─────────────────────────────────────────────── */

function InfoRow({ title, articles }: { title: string; articles: Article[] }) {
  if (!articles.length) return null;
  return (
    <div>
      <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
        <span className="w-1 h-4 bg-accent-red rounded-full" />
        {title}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {articles.slice(0, 4).map((a) => (
          <Link key={a.id} href={`/news/${a.slug}`} className="group overflow-hidden rounded-lg bg-gray-100">
            <div className="relative aspect-[16/10] overflow-hidden">
              <ArticleImage featuredImage={a.featuredImage} title={a.title} categoryName={a.category.name} className="group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute bottom-1.5 left-1.5">
                <span className="rounded bg-accent-red/90 px-1.5 py-0.5 text-[9px] font-bold text-white">{a.category.name}</span>
              </div>
            </div>
            <div className="p-2.5">
              <h4 className="text-[12px] font-bold leading-tight line-clamp-2">{a.title}</h4>
              <p className="mt-1 text-[10px] text-foreground/40">{fmtDate(a.publishedAt)} / {a.author.name}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Main Hero Section ──────────────────────────────────────────────────────── */

interface HeroSectionProps {
  sliderArticles: Article[];
  categories: Category[];
  allArticles: Article[];
  heroCategorySlugs: string[];  // from CMS config
  infoRowTitle: string;
}

export default function HeroSection({ sliderArticles, categories, allArticles, heroCategorySlugs, infoRowTitle }: HeroSectionProps) {
  // Pick 2 categories for the columns
  const col1Cat = categories.find((c) => c.slug === heroCategorySlugs[0]);
  const col2Cat = categories.find((c) => c.slug === heroCategorySlugs[1]);

  const col1Articles = col1Cat ? allArticles.filter((a) => a.category.slug === col1Cat.slug).slice(0, 2) : [];
  const col2Articles = col2Cat ? allArticles.filter((a) => a.category.slug === col2Cat.slug).slice(0, 2) : [];

  // Info row: latest 4 articles not in slider or columns
  const usedIds = new Set([
    ...sliderArticles.map((a) => a.id),
    ...col1Articles.map((a) => a.id),
    ...col2Articles.map((a) => a.id),
  ]);
  const infoArticles = allArticles.filter((a) => !usedIds.has(a.id)).slice(0, 4);

  return (
    <section className="mb-8 space-y-4">
      {/* Row 1: Slider + 2 category columns */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2 min-h-[320px] sm:min-h-[380px]">
          <Slideshow articles={sliderArticles} />
        </div>
        {col1Cat && col1Articles.length > 0 && (
          <div className="lg:col-span-1">
            <CategoryColumn category={col1Cat} articles={col1Articles} />
          </div>
        )}
        {col2Cat && col2Articles.length > 0 && (
          <div className="lg:col-span-1">
            <CategoryColumn category={col2Cat} articles={col2Articles} />
          </div>
        )}
      </div>

      {/* Row 2: Info row with 4 cards */}
      <InfoRow title={infoRowTitle} articles={infoArticles} />
    </section>
  );
}
