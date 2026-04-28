import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || 'revalidate-secret';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { secret, path, tag } = body as { secret?: string; path?: string; tag?: string };

  if (secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  if (tag) {
    revalidateTag(tag, { expire: 0 });
    return NextResponse.json({ revalidated: true, tag });
  }

  if (path) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  // Revalidate everything — bust all fetch cache tags and all page paths
  const tags = ['articles', 'categories', 'tags', 'authors', 'obituaries', 'settings'];
  for (const t of tags) {
    revalidateTag(t, { expire: 0 });
  }
  revalidatePath('/', 'layout');

  return NextResponse.json({ revalidated: true, tags });
}
