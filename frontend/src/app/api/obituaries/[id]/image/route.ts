import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_API_URL = (
  process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:4000/api'
).replace(/\/+$/, '');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const imageResponse = await fetch(
    `${BACKEND_API_URL}/obituaries/${encodeURIComponent(id)}/image`,
    { cache: 'no-store' },
  );
  const headers = new Headers();

  for (const name of ['cache-control', 'content-type', 'cross-origin-resource-policy']) {
    const value = imageResponse.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(imageResponse.body, {
    status: imageResponse.status,
    headers,
  });
}
