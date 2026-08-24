import type { NextConfig } from "next";

// Removed output: 'export' â€” this is the actual switch that turns ISR on.
// Instead of pre-building all 1355+ pages on every single deploy, each
// page now decides its own "how fresh does this need to be" timer
// (via `export const revalidate = ...` in that page's own file). A page
// is regenerated in the background the first time it's requested after
// that timer expires â€” visitors never wait on a rebuild, they always get
// an instantly-served page (either the current one, or a
// still-perfectly-fine slightly-older one while the fresh version
// generates behind the scenes).
const nextConfig: NextConfig = { // build-bust-202608241920
  compress: true,
  // Without this, Next.js's client-side Router Cache holds onto a
  // recently-visited dynamic page (e.g. /proposals/bhatti) for ~30
  // seconds by default, and can serve that stale copy if you navigate to
  // a sibling dynamic page (e.g. /proposals/shia) shortly after â€” this
  // is a separate, SHORTER-lived cache than the server-side ISR
  // `revalidate` timers elsewhere in this app, and it's specifically why
  // clicking through filters could show missing/stale content that a
  // manual refresh (which bypasses this browser-side cache) would fix.
  // Setting dynamic: 0 makes every client-side navigation to a dynamic
  // page always fetch fresh from the server, closing that gap.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  images: {
    // Use Cloudflare's built-in image resizing (cdn-cgi/image) as the
    // Next.js image loader. This converts profile photos to WebP/AVIF,
    // resizes them to the exact size needed, and serves from Cloudflare's
    // edge cache — so the /proposals page goes from loading 20 full-size
    // JPEGs to loading 20 tiny WebP thumbnails.
    //
    // Requires "Image Resizing" to be enabled in your Cloudflare dashboard:
    //   Speed → Optimization → Image Optimization → Image Resizing → ON
    // It's included on all paid plans (Pro+). Free plan: toggle it on in
    // the dashboard — Cloudflare offers it free for Workers sites.
    //
    // Format: https://joronline.com/cdn-cgi/image/{options}/{original_url}
    loader: 'custom',
    loaderFile: './lib/cloudflareImageLoader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
  // Security headers applied to every response. Not a full Content-Security-Policy
  // (that needs a careful audit of every external script/resource domain â€” Supabase,
  // GA4, R2, the flag CDN â€” to avoid silently breaking the site) â€” these are the
  // safe, broadly-applicable ones.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Stops the site being embedded in an iframe on another domain â€”
          // the classic clickjacking defense (e.g. someone overlaying an
          // invisible copy of your login/payment page to steal clicks).
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Stops browsers from guessing a file's type differently than
          // its declared Content-Type, which can be abused to execute
          // disguised scripts.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limits how much of your page's URL leaks to other sites via
          // the Referer header when a user clicks an outbound link.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Explicitly disables browser features this site doesn't use.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Tells browsers to always use HTTPS for this domain going
          // forward, even before checking â€” the middleware's httpâ†’https
          // redirect already enforces this at the app level; this adds
          // the matching enforcement at the browser level.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;