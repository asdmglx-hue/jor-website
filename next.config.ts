import type { NextConfig } from "next";

// Removed output: 'export' — this is the actual switch that turns ISR on.
// Instead of pre-building all 1355+ pages on every single deploy, each
// page now decides its own "how fresh does this need to be" timer
// (via `export const revalidate = ...` in that page's own file). A page
// is regenerated in the background the first time it's requested after
// that timer expires — visitors never wait on a rebuild, they always get
// an instantly-served page (either the current one, or a
// still-perfectly-fine slightly-older one while the fresh version
// generates behind the scenes).
const nextConfig: NextConfig = {
  compress: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
  // Security headers applied to every response. Not a full Content-Security-Policy
  // (that needs a careful audit of every external script/resource domain — Supabase,
  // GA4, R2, the flag CDN — to avoid silently breaking the site) — these are the
  // safe, broadly-applicable ones.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Stops the site being embedded in an iframe on another domain —
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
          // forward, even before checking — the middleware's http→https
          // redirect already enforces this at the app level; this adds
          // the matching enforcement at the browser level.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        // Home and Proposals are both set to `revalidate = 0` for instant
        // freshness — but that only controls Next.js's OWN cache.
        // Cloudflare's edge/CDN cache is a separate layer that can still
        // hold onto an old cached copy of the response independent of
        // that setting (confirmed directly: the database showed the
        // correct live featured-post count while an incognito browser —
        // ruling out local browser cache — still showed a stale one).
        // This explicitly tells Cloudflare's edge not to cache these two
        // pages at all, so revalidate=0 actually means instant everywhere,
        // not just at the Next.js layer.
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        source: '/proposals',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
