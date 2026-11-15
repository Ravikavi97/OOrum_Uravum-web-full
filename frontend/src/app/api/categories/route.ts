export const dynamic = 'force-dynamic';

const BACKEND_API_URL = (
  process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:4000/api'
).replace(/\/+$/, '');

export async function GET() {
  const categoriesResponse = await fetch(`${BACKEND_API_URL}/categories`, {
    cache: 'no-store',
  });
  const headers = new Headers({ 'cache-control': 'no-store' });
  const contentType = categoriesResponse.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  return new Response(categoriesResponse.body, {
    status: categoriesResponse.status,
    headers,
  });
}
