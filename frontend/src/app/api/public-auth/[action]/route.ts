import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_API_URL = (
  process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:4000/api'
).replace(/\/+$/, '');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (action !== 'config') {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
  }

  const response = await fetch(`${BACKEND_API_URL}/public-auth/config`, { cache: 'no-store' });
  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  const backendAction: Record<string, string> = {
    login: 'login',
    'register-request-code': 'register/request-code',
    'register-verify-code': 'register/verify-code',
    google: 'google',
  };
  if (!backendAction[action]) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const response = await fetch(`${BACKEND_API_URL}/public-auth/${backendAction[action]}`, {
    method: 'POST',
    headers,
    body: await request.arrayBuffer(),
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  const responseContentType = response.headers.get('content-type');
  if (responseContentType) responseHeaders.set('content-type', responseContentType);

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
