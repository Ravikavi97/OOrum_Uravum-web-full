'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArticleImage } from '@/components/article/ArticleCard';
import type { Article, PaginatedResponse } from '@/services/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ta-IN', { month: 'short', day: 'numeric' });
}

export default function PopularArticles() {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/articles?pageSize=4&status=PUBLISHED`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: PaginatedResponse<Article> | null) => {
        if (data?.data) setArticles(data.data);
      })
      .catch(() => {});
  }, []);

  if (!articles.length) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h2 className="mb-4 text-lg font-bold border-b-2 border-accent-red pb-2">
        மீள் பார்வைக்காக
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {articles.map((a) => {
          const dt = a.publishedAt ?? a.createdAt;
          return (
            <article key={a.id} className="group flex gap-3 rounded-xl bg-card-bg p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden">
                <ArticleImage
                  featuredImage={a.featuredImage}
                  title={a.title}
                  categoryName={a.category.name}
                  className="group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <Link
                  href={`/category/${a.category.slug}`}
                  className="text-[10px] font-bold text-accent-red hover:underline"
                >
                  {a.category.name}
                </Link>
                <h3 className="text-[13px] font-bold leading-tight line-clamp-2 mt-0.5">
                  <Link href={`/news/${a.slug}`} className="hover:text-accent-red transition-colors">
                    {a.title}
                  </Link>
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-foreground/40">
                  <span>{a.author.name}</span>
                  <span>·</span>
                  <time dateTime={dt}>{fmtDate(dt)}</time>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
