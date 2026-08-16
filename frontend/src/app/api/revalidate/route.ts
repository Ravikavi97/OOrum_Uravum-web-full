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

  if (tag) {
    revalidateTag(tag, 'page');
    return NextResponse.json({ revalidated: true, tag });
  }

  if (path) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  // Revalidate everything — bust all fetch cache tags and all page paths
  const tags = ['articles', 'categories', 'tags', 'authors', 'obituaries', 'settings', 'videos'];
  for (const t of tags) {
    revalidateTag(t, 'page');
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
