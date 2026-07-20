import { NextRequest, NextResponse } from 'next/server';

// Enforces a single canonical host for the whole site: non-www + https.
//
// Every page already declares its own `alternates: { canonical }` pointing
// at `https://joronline.com/...`, but that only tells Google which URL to
// PREFER — it doesn't stop `www.joronline.com` (or a stray http:// request)
// from being crawled and indexed as a separate, genuinely duplicate page
// in the first place if that host is reachable at all. Since Cloudflare's
// domain routing (which host(s) point at this Worker) is configured in the
// dashboard rather than in this repo, there's no way to confirm or rule
// that out from code alone — so this enforces the same outcome at the
// application level as a safety net: any request arriving on `www.` or
// over plain http gets a permanent redirect to the canonical host before
// anything else runs, rather than silently serving a second copy of the
// page.
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get('host') || '';
  // Cloudflare sets this even though the Worker itself always sees http
  // internally — this is the only reliable way to detect the ORIGINAL
  // scheme the visitor actually used.
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');

  const isWww = host.startsWith('www.');
  const isInsecure = proto === 'http';

  if (isWww || isInsecure) {
    const canonicalUrl = url.clone();
    canonicalUrl.protocol = 'https';
    canonicalUrl.host = host.replace(/^www\./, '');
    // 308 preserves the request method (matters for any POST endpoints
    // under /api/) — a 301/302 would silently downgrade those to GET.
    return NextResponse.redirect(canonicalUrl, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets, images, and Next's internal paths — no reason to
  // run a host check on those, and it keeps this from adding latency to
  // every single asset request.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|android-chrome|apple-touch-icon|site.webmanifest).*)',
  ],
};
