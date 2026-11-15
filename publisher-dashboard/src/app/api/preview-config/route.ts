import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configuredUrl = process.env.FRONTEND_PREVIEW_URL || 'http://localhost:3000';

  try {
    const url = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Unsupported frontend preview URL');
    }

    return NextResponse.json({ frontendUrl: url.origin });
  } catch (error) {
    console.error('[preview-config] Invalid FRONTEND_PREVIEW_URL:', error);
    return NextResponse.json(
      { error: 'Frontend preview URL is not configured correctly.' },
      { status: 500 },
    );
  }
}
