"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { ApiRequestError, searchSiteContent } from "@/services/api";
import type { SearchResult } from "@/services/api";
import Breadcrumb from "@/components/ui/Breadcrumb";

function getResultHref(result: SearchResult): string {
  switch (result.type) {
    case "article":
      return `/news/${result.slug}`;
    case "obituary":
      return `/obituary/${result.slug}`;
    case "video":
      return `/videos/${result.slug}`;
  }
}

function getResultTypeLabel(type: SearchResult["type"]): string {
  switch (type) {
    case "article":
      return "செய்தி";
    case "obituary":
      return "அஞ்சலி";
    case "video":
      return "வீடியோ";
  }
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const href = getResultHref(result);
  const description = result.description ? plainText(result.description) : "";

  return (
    <article className="group overflow-hidden rounded-xl border border-foreground/10 bg-card-bg shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={href} className="block h-full">
        <div className="relative aspect-[16/9] overflow-hidden bg-foreground/5">
          {result.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.imageUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-dark/90 to-primary-dark text-sm font-semibold text-white/70">
              {getResultTypeLabel(result.type)}
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow-sm">
            {getResultTypeLabel(result.type)}
          </span>
        </div>
        <div className="p-4">
          <h2 className="line-clamp-2 text-base font-bold leading-snug transition-colors group-hover:text-accent-red">
            {result.title}
          </h2>
          {description && (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/60">
              {description}
            </p>
          )}
          {result.publishedAt && (
            <time
              dateTime={result.publishedAt}
              className="mt-3 block text-xs text-foreground/45"
            >
              {new Date(result.publishedAt).toLocaleDateString("ta-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          )}
        </div>
      </Link>
    </article>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const hasQuery = Boolean(query.trim());
  const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const inputRef = useRef<HTMLInputElement>(null);

  const searchKey = `${query}\u0000${page}`;
  const [searchState, setSearchState] = useState<{
    key: string;
    data?: {
      data: SearchResult[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    error?: string;
  } | null>(null);
  const isLoading = hasQuery && searchState?.key !== searchKey;
  const results = searchState?.key === searchKey ? searchState.data ?? null : null;
  const error = searchState?.key === searchKey ? searchState.error ?? null : null;

  useEffect(() => {
    if (!hasQuery) return;

    const controller = new AbortController();
    searchSiteContent(query, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSearchState({ key: searchKey, data });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const message = cause instanceof ApiRequestError
          && cause.status === 400
          && cause.body.error.code === "INVALID_QUERY"
          ? "அதிகபட்சம் 8 சொற்கள் மற்றும் 120 எழுத்துகள் வரை தேடலாம்."
          : "தேடலில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.";
        setSearchState({ key: searchKey, error: message });
      });

    return () => controller.abort();
  }, [query, page, searchKey, hasQuery]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";
    if (value) {
      router.push(`/search?q=${encodeURIComponent(value)}`);
    } else {
      router.push("/search");
    }
  }

  function goToPage(nextPage: number) {
    router.push(`/search?q=${encodeURIComponent(query)}&page=${nextPage}`);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[
        { label: "முகப்பு", href: "/" },
        { label: "தேடல்" },
      ]} />
      <h1 className="mb-6 text-3xl font-bold">தேடல்</h1>

      <form onSubmit={handleSubmit} className="mb-2 flex gap-2">
        <input
          key={query}
          ref={inputRef}
          type="search"
          defaultValue={query}
          maxLength={120}
          aria-label="தேடல்"
          placeholder="செய்திகள், அஞ்சலிகள், வீடியோக்களைத் தேடுங்கள்..."
          className="min-w-0 flex-1 rounded border border-foreground/20 bg-background px-4 py-2 text-base focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-accent-red px-6 py-2 text-sm font-medium text-white hover:bg-accent-red/90"
        >
          தேடு
        </button>
      </form>
      <p className="mb-8 text-xs text-foreground/45">
        செய்திகள், அஞ்சலிகள் மற்றும் வீடியோக்களில் தேடலாம் (அதிகபட்சம் 8 சொற்கள்).
      </p>

      {isLoading && (
        <p role="status" aria-live="polite" className="py-8 text-center text-foreground/60">
          தேடுகிறது...
        </p>
      )}

      {!isLoading && error && (
        <p role="alert" className="py-8 text-center text-red-600">{error}</p>
      )}

      {!isLoading && !error && hasQuery && results && (
        <>
          <p className="mb-4 break-words text-sm text-foreground/60">
            &quot;{query}&quot; — {results.total} முடிவுகள்
          </p>

          {results.data.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.data.map((result) => (
                <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-foreground/60">முடிவுகள் இல்லை</p>
          )}

          {results.totalPages > 1 && (
            <nav aria-label="தேடல் முடிவுகள் பக்கங்கள்" className="mt-8 flex items-center justify-center gap-4">
              {page > 1 && (
                <button
                  onClick={() => goToPage(page - 1)}
                  className="rounded bg-foreground/10 px-4 py-2 text-sm hover:bg-foreground/20"
                >
                  முந்தைய
                </button>
              )}
              <span className="text-sm text-foreground/60">
                பக்கம் {page} / {results.totalPages}
              </span>
              {page < results.totalPages && (
                <button
                  onClick={() => goToPage(page + 1)}
                  className="rounded bg-foreground/10 px-4 py-2 text-sm hover:bg-foreground/20"
                >
                  அடுத்த
                </button>
              )}
            </nav>
          )}
        </>
      )}

      {!isLoading && !error && !hasQuery && (
        <p className="py-12 text-center text-foreground/60">
          தேட மேலே உள்ள பெட்டியில் ஒரு தலைப்பு, பெயர் அல்லது முக்கிய சொல்லை உள்ளிடவும்.
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
