import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// This tells the Cloudflare adapter where to actually store each
// regenerated page (the "incremental cache" ISR relies on) — reusing the
// same R2 bucket already set up for CNIC and profile photos, under its
// own separate folder, so no new storage needs to be created.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
