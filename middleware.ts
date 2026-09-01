import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');

  const isWww = host.startsWith('www.');
  const isInsecure = proto === 'http';

  if (isWww || isInsecure) {
    const canonicalUrl = url.clone();
    canonicalUrl.protocol = 'https';
    canonicalUrl.host = host.replace(/^www\./, '');
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const pathname = url.pathname;
  if (/^\/[$&]/.test(pathname)) {
    const cleanUrl = url.clone();
    cleanUrl.pathname = '/';
    cleanUrl.search = '';
    return NextResponse.redirect(cleanUrl, 301);
  }

  // Return 410 Gone for permanently deleted profile pages.
  // 410 tells Google the URL is intentionally gone — removes it from
  // the index much faster than a 404.
  const profileMatch = pathname.match(/^\/profile\/(\d+)$/);
  if (profileMatch) {
    const num = profileMatch[1];
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/deleted_proposal_numbers?proposal_number=eq.${num}&select=proposal_number&limit=1`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
            // Cache for 1 hour — deleted profiles rarely come back
            // @ts-ignore next-specific fetch option
            next: { revalidate: 3600 },
          }
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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|android-chrome|apple-touch-icon|site.webmanifest).*)',
  ],
};
