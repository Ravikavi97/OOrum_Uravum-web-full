/**
 * Article Serializer / Deserializer
 *
 * Converts Prisma Article objects (with relations) to JSON-safe SerializedArticle
 * and back to ArticleInput-like objects for round-trip data integrity.
 */

export interface SerializedArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  isBreaking: boolean;
  featuredImage: string | null;
  author: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  tags: Array<{ id: string; name: string; slug: string }>;
  createdAt: string;
  updatedAt: string;
}

/** Shape of a Prisma Article with included relations */
export interface ArticleWithRelations {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: Date | null;
  isBreaking: boolean;
  featuredImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  tags: Array<{ tag: { id: string; name: string; slug: string } }>;
}

/** Shape returned by deserializeArticle — an ArticleInput-like object */
export interface DeserializedArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: Date | null;
  isBreaking: boolean;
  featuredImage: string | null;
  author: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  tags: Array<{ id: string; name: string; slug: string }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serialize a Prisma Article (with relations) to a JSON-safe SerializedArticle.
 * Converts Date objects to ISO strings and flattens the ArticleTag junction.
 */
export function serializeArticle(article: ArticleWithRelations): SerializedArticle {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    content: article.content,
    excerpt: article.excerpt,
    status: article.status,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    isBreaking: article.isBreaking,
    featuredImage: article.featuredImage,
    author: {
      id: article.author.id,
      name: article.author.name,
      slug: article.author.slug,
    },
    category: {
      id: article.category.id,
      name: article.category.name,
      slug: article.category.slug,
    },
    tags: article.tags.map((at) => ({
      id: at.tag.id,
      name: at.tag.name,
      slug: at.tag.slug,
    })),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

/**
 * Deserialize a SerializedArticle JSON back to an ArticleInput-like object.
 * Converts ISO date strings back to Date objects.
 */
export function deserializeArticle(json: SerializedArticle): DeserializedArticle {
  return {
    id: json.id,
    title: json.title,
    slug: json.slug,
    content: json.content,
    excerpt: json.excerpt,
    status: json.status,
    publishedAt: json.publishedAt ? new Date(json.publishedAt) : null,
    isBreaking: json.isBreaking,
    featuredImage: json.featuredImage,
    author: { ...json.author },
    category: { ...json.category },
    tags: json.tags.map((t) => ({ ...t })),
    createdAt: new Date(json.createdAt),
    updatedAt: new Date(json.updatedAt),
  };
}
