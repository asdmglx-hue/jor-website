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

  // Malformed URLs like https://joronline.com/$ and https://joronline.com/&
  // appear in Google Search Console as 404s — these are caused by broken
  // links or scrapers appending junk characters. Redirect them cleanly to
  // the homepage rather than letting them become dead ends that hurt rankings.
  const pathname = url.pathname;
  if (/^\/[$&]/.test(pathname)) {
    const cleanUrl = url.clone();
    cleanUrl.pathname = '/';
    cleanUrl.search = '';
    return NextResponse.redirect(cleanUrl, 301);
  }

  // Return 410 Gone for permanently deleted profile pages.
  // 410 is stronger than 404 — it tells Google the URL is intentionally
  // gone and should be removed from the index immediately, not just
  // treated as a temporary error.
  const profileMatch = pathname.match(/^\/profile\/(\d+)$/);
  if (profileMatch) {
    const num = profileMatch[1];
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const res = await fetch(
          ,
          { headers: { apikey: supabaseKey, Authorization:  }, next: { revalidate: 3600 } }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            return new NextResponse(null, {
              status: 410,
              headers: { 'Cache-Control': 'public, max-age=86400' },
            });
          }
        }
      }
    } catch {
      // Never break navigation over SEO signals
    }
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
