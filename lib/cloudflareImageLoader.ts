// Custom Next.js image loader that routes through Cloudflare Image Resizing.
//
// HOW IT WORKS:
// Cloudflare Image Resizing intercepts requests to /cdn-cgi/image/{options}/{url}
// on your own domain and returns a resized, format-converted (WebP/AVIF) version
// cached at Cloudflare's edge — no origin hit after the first request.
//
// This replaces `unoptimized: true` in next.config.ts, which previously served
// every profile photo at full original size (often 2-5 MB JPEGs). With this
// loader, a 52px avatar on the proposals page fetches ~3 KB instead of ~3 MB.
//
// SETUP REQUIRED (one-time, in Cloudflare dashboard):
//   Speed → Optimization → Image Optimization → Image Resizing → ON
//   (included on all plans; free for Workers sites)
//
// FORMAT PRIORITY: Cloudflare auto-negotiates the best format the browser
// supports — AVIF for Chrome/Firefox, WebP for Safari, JPEG fallback.
// No configuration needed; Accept header drives it automatically.

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Local dev / non-Cloudflare environments: return src as-is so images
  // still work without the cdn-cgi path (which only exists on Cloudflare).
  if (process.env.NODE_ENV === 'development') return src;

  const q = quality ?? 80;
  // format=auto lets Cloudflare pick the best format per browser (AVIF → WebP → JPEG).
  // fit=cover keeps the image filling its container without distortion.
  const options = `width=${width},quality=${q},format=auto,fit=cover`;
  return `/cdn-cgi/image/${options}/${src}`;
}
