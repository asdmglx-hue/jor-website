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
  // @cf-wasm/photon (image watermarking) ships a workerd-specific
  // entrypoint for Cloudflare Workers. Left to its own devices, Next.js's
  // own build step tries to resolve that import using standard "node"
  // conditions and fails, since "workerd" isn't one it knows about.
  // Listing the package here tells Next.js to leave it alone entirely —
  // OpenNext's separate Cloudflare-specific bundling step (which runs
  // after `next build`) is the one that actually understands the
  // "workerd" condition and resolves it correctly.
  serverExternalPackages: ['@cf-wasm/photon'],
  // Without this, Next.js's client-side Router Cache holds onto a
  // recently-visited dynamic page (e.g. /proposals/bhatti) for ~30
  // seconds by default, and can serve that stale copy if you navigate to
  // a sibling dynamic page (e.g. /proposals/shia) shortly after — this
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
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
  // Needed specifically for @cf-wasm/photon (image watermarking) — it
  // ships a .wasm file, and webpack doesn't handle WebAssembly imports
  // by default without this being explicitly turned on.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // serverExternalPackages (above) stops Next.js from bundling
    // @cf-wasm/photon's contents in — but webpack still separately needs
    // to be told "workerd" is a real condition to recognize when it
    // resolves *which file* that import even points to. Without this,
    // it doesn't know the package's workerd-specific entrypoint exists
    // at all, even though it isn't being asked to bundle it.
    // '...' keeps webpack's own default conditions alongside this one.
    config.resolve.conditionNames = ['workerd', '...'];
    return config;
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
    ];
  },
};

export default nextConfig;
