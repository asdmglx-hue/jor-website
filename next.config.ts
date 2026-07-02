import type { NextConfig } from "next";

// output: 'export' makes this a fully static site — no Node.js server
// required at runtime. Images are unoptimized because Next's built-in
// Image Optimization needs a running server; your images already come
// from Supabase Storage / Cloudflare R2, which handle their own delivery.
const nextConfig: NextConfig = {
  output: 'export',
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
