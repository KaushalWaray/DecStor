import { NextResponse } from 'next/server';

// Proxy route: forwards POST /api/bulk/commit to the backend service.
// This helps browser environments (remote previews) reach the backend via the Next.js server.

export async function POST(request: Request) {
  try {
    const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const url = `${String(backend).replace(/\/$/, '')}/api/bulk/commit`;
    const body = await request.text();

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type') || 'application/json' },
      body,
    });

    const text = await res.text();
    const headers = { 'Content-Type': res.headers.get('content-type') || 'text/plain' };
    return new NextResponse(text, { status: res.status, headers });
  } catch (err) {
    console.error('[Proxy] Failed to forward bulk/commit to backend:', err);
    return NextResponse.json({ error: 'Proxy error: could not reach backend.' }, { status: 502 });
  }
}
