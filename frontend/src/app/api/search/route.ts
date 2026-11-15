import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_API_URL = (
  process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:4000/api'
).replace(/\/+$/, '');

export async function GET(request: NextRequest) {
  const searchUrl = new URL(`${BACKEND_API_URL}/search`);
  request.nextUrl.searchParams.forEach((value, key) => {
    searchUrl.searchParams.append(key, value);
  });

  const searchResponse = await fetch(searchUrl, { cache: 'no-store' });
  const headers = new Headers({ 'cache-control': 'no-store' });
  const contentType = searchResponse.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  return new Response(searchResponse.body, {
    status: searchResponse.status,
    headers,
  });
}
