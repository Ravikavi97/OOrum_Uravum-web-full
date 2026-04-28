"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import type { Article, PaginatedResponse } from "@/services/api";
import ArticleCard from "@/components/article/ArticleCard";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

async function fetchSearchResults(
  query: string,
  page: number,
): Promise<PaginatedResponse<Article>> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  const res = await fetch(`${BASE_URL}/search?${params}`);
  if (!res.ok) {
    throw new Error("Search failed");
  }
  return res.json();
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const pageParam = parseInt(searchParams.get("page") || "1", 10) || 1;

  const [input, setInput] = useState(query);
  const [results, setResults] = useState<PaginatedResponse<Article> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(
    async (q: string, page: number) => {
      if (!q.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSearchResults(q, page);
        setResults(data);
      } catch {
        setError("தேடலில் பிழை ஏற்பட்டது");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (query) {
      doSearch(query, pageParam);
    }
  }, [query, pageParam, doSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      router.push(`/search?q=${encodeURIComponent(input.trim())}`);
    }
  }

  function goToPage(page: number) {
    router.push(
      `/search?q=${encodeURIComponent(query)}&page=${page}`,
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">தேடல்</h1>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="செய்திகளைத் தேடுங்கள்..."
          className="flex-1 rounded border border-foreground/20 bg-background px-4 py-2 text-base focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-accent-red px-6 py-2 text-sm font-medium text-white hover:bg-accent-red/90"
        >
          தேடு
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <p className="py-8 text-center text-foreground/60">தேடுகிறது...</p>
      )}

      {/* Error */}
      {error && <p className="py-8 text-center text-red-600">{error}</p>}

      {/* Results */}
      {!loading && results && (
        <>
          <p className="mb-4 text-sm text-foreground/60">
            &quot;{query}&quot; — {results.total} முடிவுகள்
          </p>

          {results.data.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.data.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-foreground/60">
              முடிவுகள் இல்லை
            </p>
          )}

          {/* Pagination */}
          {results.totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-4">
              {pageParam > 1 && (
                <button
                  onClick={() => goToPage(pageParam - 1)}
                  className="rounded bg-foreground/10 px-4 py-2 text-sm hover:bg-foreground/20"
                >
                  முந்தைய
                </button>
              )}
              <span className="text-sm text-foreground/60">
                பக்கம் {pageParam} / {results.totalPages}
              </span>
              {pageParam < results.totalPages && (
                <button
                  onClick={() => goToPage(pageParam + 1)}
                  className="rounded bg-foreground/10 px-4 py-2 text-sm hover:bg-foreground/20"
                >
                  அடுத்த
                </button>
              )}
            </nav>
          )}
        </>
      )}

      {/* Empty state when no query */}
      {!loading && !results && !query && (
        <p className="py-12 text-center text-foreground/60">
          செய்திகளைத் தேட மேலே உள்ள தேடல் பெட்டியைப் பயன்படுத்தவும்
        </p>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="py-8 text-center text-foreground/60">ஏற்றுகிறது...</p>
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
