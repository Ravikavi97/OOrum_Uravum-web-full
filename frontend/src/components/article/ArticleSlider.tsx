'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Article } from '@/services/api';
import { ArticleImage } from './ArticleCard';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ta-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ArticleSlider({ articles }: { articles: Article[] }) {
  const [current, setCurrent] = useState(0);
  const count = articles.length;

  const next = useCallback(() => setCurrent((c) => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + count) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [count, next]);

  if (count === 0) return null;

  const article = articles[current];

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-card-bg shadow-sm">
      {/* Slide */}
      <div className="relative aspect-[16/7] sm:aspect-[16/6] w-full">
        <div className="absolute inset-0">
          <ArticleImage
            featuredImage={article.featuredImage}
            title={article.title}
            categoryName={article.category.name}
          />
        </div>
        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <Link
            href={`/category/${article.category.slug}`}
            className="inline-block rounded bg-accent-red px-2.5 py-1 text-xs font-bold text-white hover:bg-accent-red/90 transition-colors"
          >
            {article.category.name}
          </Link>
          <h2 className="mt-2 text-xl sm:text-2xl md:text-3xl font-bold text-white leading-snug line-clamp-2">
            <Link href={`/news/${article.slug}`} className="hover:underline">
              {article.title}
            </Link>
          </h2>
          {article.excerpt && (
            <p className="mt-2 text-sm text-white/80 line-clamp-2 max-w-2xl">{article.excerpt}</p>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
            <span className="font-medium text-white/80">{article.author.name}</span>
            <span>·</span>
            <time dateTime={article.publishedAt ?? article.createdAt}>
              {formatDate(article.publishedAt ?? article.createdAt)}
            </time>
          </div>
        </div>
      </div>

      {/* Prev / Next arrows */}
      {count > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Previous slide"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Next slide"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {articles.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
