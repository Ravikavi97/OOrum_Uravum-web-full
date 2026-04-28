import type { Article } from "@/services/api";

interface JsonLdProps {
  article: Article;
  siteUrl: string;
}

export default function JsonLd({ article, siteUrl }: JsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.publishedAt || article.createdAt,
    dateModified: article.updatedAt,
    author: {
      "@type": "Person",
      name: article.author.name,
      url: `${siteUrl}/author/${article.author.slug}`,
    },
    publisher: {
      "@type": "Organization",
      name: "ஊரும் உறவும்",
      url: siteUrl,
    },
    image: article.featuredImage || undefined,
    url: `${siteUrl}/news/${article.slug}`,
    description: article.excerpt || undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
