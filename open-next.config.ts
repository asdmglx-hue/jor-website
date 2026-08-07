import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Switched from r2IncrementalCache to no incremental cache.
// All pages use revalidate=false with on-demand revalidation via Supabase
// webhooks — so we don't need ISR cache at all. Pages are served as
// static/dynamic without R2 caching, eliminating:
// 1. The 57,000+ R2 writes at build time that caused build timeouts
// 2. The millions of R2 Class A operations that caused the $18.50 bill
// On-demand revalidation via /api/webhooks/proposal-status-changed
// handles all cache invalidation when content changes.
export default defineCloudflareConfig({});
