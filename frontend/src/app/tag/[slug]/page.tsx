import type { Metadata } from "next";
import { getArticles, getTags } from "@/services/api";
import ArticleCard from "@/components/article/ArticleCard";
import Pagination from "@/components/ui/Pagination";

export const revalidate = 10;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tags = await getTags();
    const tag = tags.find((t) => t.slug === slug);
    if (!tag) return { title: "குறிச்சொல்" };
    return { title: `#${tag.name} - ஊரும் உறவும்`, alternates: { canonical: `${SITE_URL}/tag/${slug}` } };
  } catch { return { title: "குறிச்சொல்" }; }
}

export default async function TagPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const { page: pp } = await searchParams;
  const page = Math.max(1, parseInt(pp || "1", 10) || 1);

  let tags: import("@/services/api").Tag[] = [];
  try { tags = await getTags(); } catch { /* empty */ }
  const tag = tags.find((t) => t.slug === slug);

  let result;
  try { result = await getArticles({ tag: slug, page, pageSize: 9, status: "PUBLISHED" }); }
  catch { result = { data: [], total: 0, page: 1, pageSize: 9, totalPages: 0 }; }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold border-b-2 border-primary-dark pb-2">#{tag?.name || slug}</h1>
      {result.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      ) : (
        <p className="py-12 text-center text-foreground/60">இந்த குறிச்சொல்லில் செய்திகள் இல்லை</p>
      )}
      <Pagination currentPage={page} totalPages={result.totalPages} basePath={`/tag/${slug}`} />
    </main>
  );
}
