import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/services/api";
import { ApiRequestError } from "@/services/api";
import JsonLd from "@/components/seo/JsonLd";
import CommentsSection from "@/components/article/CommentsSection";
import { ArticleImage } from "@/components/article/ArticleCard";

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const article = await getArticleBySlug(slug);
    const url = `${SITE_URL}/news/${slug}`;

    return {
      title: article.title,
      description: article.excerpt || undefined,
      openGraph: {
        title: article.title,
        description: article.excerpt || undefined,
        url,
        type: "article",
        images: article.featuredImage ? [article.featuredImage] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.excerpt || undefined,
        images: article.featuredImage ? [article.featuredImage] : undefined,
      },
      alternates: {
        canonical: url,
      },
    };
  } catch {
    return { title: "செய்தி" };
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ta-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let article;
  try {
    article = await getArticleBySlug(slug);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      notFound();
    }
    // Network error — show not found instead of crashing
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <JsonLd article={article} siteUrl={SITE_URL} />
      {/* Category */}
      <Link
        href={`/category/${article.category.slug}`}
        className="text-sm font-semibold uppercase tracking-wide text-blue-600 hover:underline"
      >
        {article.category.name}
      </Link>

      {/* Title */}
      <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
        {article.title}
      </h1>

      {/* Meta: author + date */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/60">
        <Link
          href={`/author/${article.author.slug}`}
          className="font-medium text-foreground/80 hover:underline"
        >
          {article.author.name}
        </Link>
        <span>·</span>
        <time dateTime={article.publishedAt ?? article.createdAt}>
          {formatDate(article.publishedAt ?? article.createdAt)}
        </time>
      </div>

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tag/${tag.slug}`}
              className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/70 hover:bg-foreground/10"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Featured image */}
      <div className="mt-6 overflow-hidden rounded-lg aspect-[16/8]">
        <ArticleImage
          featuredImage={article.featuredImage}
          title={article.title}
          categoryName={article.category.name}
        />
      </div>

      {/* Article body */}
      <div
        className="prose prose-lg mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Comments section */}
      <CommentsSection articleId={article.id} />
    </main>
  );
}
