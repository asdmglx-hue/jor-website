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
};

export default nextConfig;
