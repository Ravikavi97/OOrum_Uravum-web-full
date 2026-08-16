/**
 * API Proxy Route — forwards CMS requests to the backend API
 * without the browser-added Origin header (which triggers Imunify360 WAF).
 * 
 * Browser → cms.oorumuravum.com/api/proxy/... → api.oorumuravum.com/api/...
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api')
  .replace(/\/$/, '');

// Internal API URL for server-to-server (avoids WAF)
const INTERNAL_API = process.env.INTERNAL_API_URL || BACKEND_API;

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join('/');
  const url = new URL(req.url);
  const queryString = url.search;
  const targetUrl = `${INTERNAL_API}/${pathStr}${queryString}`;

  // Forward relevant headers but NOT Origin (to bypass WAF)
  const forwardHeaders: Record<string, string> = {
    'content-type': req.headers.get('content-type') || 'application/json',
  };

  const auth = req.headers.get('authorization');
  if (auth) forwardHeaders['authorization'] = auth;

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: forwardHeaders,
    body,
  });

  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
