import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || 'revalidate-secret';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { secret, path, tag } = body as { secret?: string; path?: string; tag?: string };

  if (secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  // The backend calls this route after every CMS mutation, so tagged data must
  // expire immediately rather than serve stale content. Next 16 requires a
  // cacheLife profile as the second argument — `{ expire: 0 }` is the
  // documented pattern for external callers (webhooks) that need the very next
  // request to refetch. A named profile like 'max' would keep serving stale
  // data, and an undefined profile such as 'page' is not a valid cacheLife
  // profile, so it never expires the entry at all.
  const EXPIRE_NOW = { expire: 0 } as const;

  if (tag) {
    revalidateTag(tag, EXPIRE_NOW);
    return NextResponse.json({ revalidated: true, tag, profile: 'expire:0' });
  }

  if (path) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  // Revalidate everything — bust all fetch cache tags and all page paths
  const tags = ['articles', 'categories', 'tags', 'authors', 'obituaries', 'settings', 'videos', 'ads'];
  for (const t of tags) {
    revalidateTag(t, EXPIRE_NOW);
  }
  revalidatePath('/', 'layout');
  revalidatePath('/news/[slug]', 'page');
  revalidatePath('/category/[slug]', 'page');
  revalidatePath('/author/[slug]', 'page');
  revalidatePath('/tag/[slug]', 'page');
  revalidatePath('/videos', 'page');

  return NextResponse.json({ revalidated: true, tags, timestamp: new Date().toISOString() });
}

// Also support GET for health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'revalidate' });
}
