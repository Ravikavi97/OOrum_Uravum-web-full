/**
 * Feed generator — produces RSS 2.0 and JSON Feed 1.1 from article data.
 */

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const SITE_TITLE = 'ஊரும் உறவும் - Tamil News';
const SITE_DESCRIPTION = 'தமிழ் செய்திகள் - அரசியல், விளையாட்டு, உள்ளூர், உலகம்';

export interface FeedArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  publishedAt: Date | string | null;
  author: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  tags: Array<{ id: string; name: string; slug: string }>;
  featuredImage?: string | null;
}

export interface ArticleMetadata {
  title: string;
  link: string;
  description: string;
  author: string;
  pubDate: string;
  categories: string[];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate RSS 2.0 XML from a list of articles.
 */
export function generateRssFeed(articles: FeedArticle[]): string {
  const items = articles.map((a) => {
    const link = `${SITE_URL}/news/${a.slug}`;
    const pubDate = a.publishedAt
      ? new Date(a.publishedAt).toUTCString()
      : new Date().toUTCString();
    const description = a.excerpt || a.content.substring(0, 200);
    const categories = [
      a.category.name,
      ...a.tags.map((t) => t.name),
    ];

    return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <author>${escapeXml(a.author.name)}</author>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
${categories.map((c) => `      <category>${escapeXml(c)}</category>`).join('\n')}
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ta</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>`;
}

/**
 * Parse RSS 2.0 XML and extract article metadata.
 * Simple regex-based parser for round-trip testing.
 */
export function parseRssFeed(xml: string): ArticleMetadata[] {
  const results: ArticleMetadata[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const getTag = (tag: string): string => {
      const tagMatch = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(itemXml);
      return tagMatch ? unescapeXml(tagMatch[1].trim()) : '';
    };

    const getAllTags = (tag: string): string[] => {
      const tags: string[] = [];
      const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
      let tagMatch;
      while ((tagMatch = tagRegex.exec(itemXml)) !== null) {
        tags.push(unescapeXml(tagMatch[1].trim()));
      }
      return tags;
    };

    results.push({
      title: getTag('title'),
      link: getTag('link'),
      description: getTag('description'),
      author: getTag('author'),
      pubDate: getTag('pubDate'),
      categories: getAllTags('category'),
    });
  }

  return results;
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Generate JSON Feed 1.1 from a list of articles.
 */
export function generateJsonFeed(articles: FeedArticle[]): string {
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE_TITLE,
    home_page_url: SITE_URL,
    feed_url: `${SITE_URL}/api/feed/json`,
    description: SITE_DESCRIPTION,
    language: 'ta',
    items: articles.map((a) => ({
      id: a.id,
      url: `${SITE_URL}/news/${a.slug}`,
      title: a.title,
      content_html: a.content,
      summary: a.excerpt || a.content.substring(0, 200),
      date_published: a.publishedAt
        ? new Date(a.publishedAt).toISOString()
        : undefined,
      authors: [{ name: a.author.name }],
      tags: [a.category.name, ...a.tags.map((t) => t.name)],
      ...(a.featuredImage ? { image: a.featuredImage } : {}),
    })),
  };

  return JSON.stringify(feed, null, 2);
}
