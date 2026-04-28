import type { MetadataRoute } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFrequency: string;
  priority: number;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${API_URL}/sitemap`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const entries: SitemapEntry[] = await res.json();
    return entries.map((entry) => ({
      url: entry.url,
      lastModified: entry.lastModified,
      changeFrequency: entry.changeFrequency as 'hourly' | 'daily' | 'weekly' | 'monthly',
      priority: entry.priority,
    }));
  } catch {
    return [];
  }
}
