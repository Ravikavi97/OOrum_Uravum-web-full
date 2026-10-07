import type { Metadata } from "next";
import Link from "next/link";
import { getArticles, getCategories, getObituaries } from "@/services/api";
import type { Obituary } from "@/services/api";
import ArticleCard from "@/components/article/ArticleCard";
import Pagination from "@/components/ui/Pagination";
import Breadcrumb from "@/components/ui/Breadcrumb";

export const revalidate = 10;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const cats = await getCategories();
    const cat = cats.find((c) => c.slug === slug);
    if (!cat) return { title: "பிரிவு" };
    return { title: `${cat.name} - ஊரும் உறவும்`, description: cat.description || `${cat.name} பிரிவு செய்திகள்`, alternates: { canonical: `${SITE_URL}/category/${slug}` } };
  } catch { return { title: "பிரிவு" }; }
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const { page: pp } = await searchParams;
  const page = Math.max(1, parseInt(pp || "1", 10) || 1);

  let categories: import("@/services/api").Category[] = [];
  try { categories = await getCategories(); } catch { /* empty */ }
  const category = categories.find((c) => c.slug === slug);

  // Find parent category for breadcrumb
  const parentCategory = category?.parent?.id
    ? categories.find((c) => c.id === category.parent!.id)
    : null;

  // Find subcategories of this category
  const subcategories = category?.children || [];

  // Check if this is the obituary/tribute category
  const isObituaryCategory = slug === 'thuyarpakirvoom' || category?.description?.toLowerCase().includes('obituar');

  // Build category filter list: current category + all subcategories
  const categoryFilter = [slug, ...subcategories.map((c) => c.slug)];

  let result;
  try {
    result = await getArticles({
      category: categoryFilter.join(','),
      page,
      pageSize: 9,
      status: "PUBLISHED"
    });
  }
  catch { result = { data: [], total: 0, page: 1, pageSize: 9, totalPages: 0 }; }

  // Fetch standalone obituaries for the obituary category
  let obituaries: Obituary[] = [];
  if (isObituaryCategory) {
    try {
      const obitsRes = await getObituaries({ pageSize: 50 });
      obituaries = obitsRes.data;
    } catch { /* empty */ }
  }

  const hasContent = result.data.length > 0 || obituaries.length > 0;

  // Build breadcrumb with full hierarchy
  const breadcrumbItems: Array<{ label: string; href?: string }> = [
    { label: 'முகப்பு', href: '/' },
  ];

  if (parentCategory) {
    breadcrumbItems.push({
      label: parentCategory.name,
      href: `/category/${parentCategory.slug}`,
    });
  }

  breadcrumbItems.push({
    label: category?.name || slug,
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={breadcrumbItems} />
      <h1 className="mb-6 text-2xl font-bold border-b-2 border-primary-dark pb-2">{category?.name || slug}</h1>
      {category?.description && <p className="mb-6 text-foreground/60 text-sm">{category.description}</p>}

      {/* Subcategories navigation */}
      {subcategories.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-foreground/80">Subcategories</h2>
          <div className="flex flex-wrap gap-3">
            {subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/category/${sub.slug}`}
                className="px-4 py-2 bg-card-bg border border-gray-200 rounded-lg hover:border-accent-red hover:text-accent-red transition-colors text-sm font-medium"
              >
                {sub.name}
                {sub._count?.articles !== undefined && sub._count.articles !== null && (
                  <span className="ml-2 text-xs text-foreground/50">({sub._count.articles})</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Articles in this category and subcategories */}
      {result.data.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {result.data.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
          {result.totalPages > 1 && (
            <Pagination currentPage={page} totalPages={result.totalPages} basePath={`/category/${slug}`} />
          )}
        </>
      )}

      {/* Standalone obituaries (only for obituary category) */}
      {obituaries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {obituaries.map((o) => (
            <Link key={o.id} href={`/obituary/${o.slug}`} className="block rounded-2xl bg-card-bg shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-gray-300 to-gray-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/obituaries/${o.id}/image`}
                  alt={o.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-base font-bold leading-snug line-clamp-2 min-h-[2.75rem]">{o.name}</h3>
                <p className="mt-1.5 text-xs text-foreground/50 line-clamp-2">{o.content}</p>
                <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-foreground/40">
                  {new Date(o.publishedAt).toLocaleDateString("ta-IN", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!hasContent && (
        <p className="py-12 text-center text-foreground/60">இந்த பிரிவில் செய்திகள் இல்லை</p>
      )}
    </main>
  );
}
