import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorBySlug, getArticles } from "@/services/api";
import ArticleCard from "@/components/article/ArticleCard";
import Pagination from "@/components/ui/Pagination";

export const revalidate = 60;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const a = await getAuthorBySlug(slug);
    return { title: `${a.name} - ஊரும் உறவும்`, description: a.bio || `${a.name} எழுதிய செய்திகள்`, alternates: { canonical: `${SITE_URL}/author/${slug}` } };
  } catch { return { title: "ஆசிரியர்" }; }
}

export default async function AuthorPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const { page: pp } = await searchParams;
  const page = Math.max(1, parseInt(pp || "1", 10) || 1);

  let author;
  try { author = await getAuthorBySlug(slug); } catch { notFound(); }

  let result;
  try { result = await getArticles({ author: slug, page, pageSize: 9, status: "PUBLISHED" }); }
  catch { result = { data: [], total: 0, page: 1, pageSize: 9, totalPages: 0 }; }

  const social = author.socialLinks as Record<string, string> | null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {author.profileImage && <img src={author.profileImage} alt={author.name} className="h-24 w-24 rounded-full object-cover" />}
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold">{author.name}</h1>
          {author.bio && <p className="mt-2 text-foreground/60 text-sm">{author.bio}</p>}
          {social && Object.keys(social).length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-3 sm:justify-start">
              {Object.entries(social).map(([p, u]) => <a key={p} href={u} target="_blank" rel="noopener noreferrer" className="text-sm text-link-blue hover:underline">{p}</a>)}
            </div>
          )}
        </div>
      </section>
      <h2 className="mb-5 text-xl font-bold border-b-2 border-primary-dark pb-2">கட்டுரைகள்</h2>
      {result.data.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      ) : (
        <p className="py-12 text-center text-foreground/60">இந்த ஆசிரியரின் கட்டுரைகள் இல்லை</p>
      )}
      <Pagination currentPage={page} totalPages={result.totalPages} basePath={`/author/${slug}`} />
    </main>
  );
}
