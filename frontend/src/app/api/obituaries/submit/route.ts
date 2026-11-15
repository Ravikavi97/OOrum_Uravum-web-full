import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_API_URL = (
  process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:4000/api'
).replace(/\/+$/, '');

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);

  const response = await fetch(`${BACKEND_API_URL}/obituaries/submit`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
