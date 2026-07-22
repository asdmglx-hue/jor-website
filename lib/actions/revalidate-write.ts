'use server';

import { revalidatePath } from 'next/cache';

// ============================================================================
//  🚪 THE SINGLE DOORWAY — read this before adding ANY new database write
// ============================================================================
//
// WHAT THIS FILE IS:
// Every Server Action that writes data affecting a cached page (a new
// proposal, a Featured booking/cancellation, a profile edit/pause/delete)
// must call one of the two functions below immediately after the write
// succeeds. This is the ONLY file in the whole codebase that is allowed to
// import `revalidatePath` or `revalidateTag` from 'next/cache'.
//
// WHY IT WORKS THIS WAY:
// Pages are cached via `export const revalidate = 300` (a 5-minute safety
// net — see lib/supabase.ts and each page.tsx for the same pattern). That
// timer alone means a real change can take up to 5 minutes to appear. These
// two functions let a Server Action say "this changed right now — refresh
// it," without removing or replacing the 300s fallback. If a future write
// path forgets to call these, the 300s timer still self-heals it — nothing
// can go permanently stale.
//
// WHO CALLS THESE TWO FUNCTIONS TODAY:
//   - lib/actions/featured-actions.ts (Featured booking/cancellation)
//   - lib/actions/proposal-actions.ts (proposal submit/update/pause/delete)
//   - app/api/webhooks/proposal-status-changed/route.ts — a Supabase
//     Database Webhook fires this the instant a proposal's status changes
//     from OUTSIDE the website (i.e. admin approval/rejection in the
//     separate Admin app). This is the one entry point that ISN'T a Server
//     Action, since a webhook receiver has to be an HTTP route — but it
//     still funnels through these same two functions, never its own
//     revalidatePath call.
//
// ⚠️  INSTRUCTIONS FOR THE NEXT PERSON (OR AI) ADDING A NEW WRITE ACTION:
//   1. Do NOT call revalidatePath/revalidateTag directly from your new
//      Server Action file. Import and call revalidateListings() (and
//      revalidateProfile() if you know the specific proposal_number) from
//      HERE instead.
//   2. If your write doesn't fit either function below (e.g. it affects a
//      page neither of these touches), ADD A NEW EXPORTED FUNCTION TO THIS
//      FILE rather than reaching for revalidatePath in your own file. Keep
//      the doorway as the only entry point.
//   3. When in doubt, call revalidateListings() anyway — over-refreshing a
//      rare write is cheap and safe; under-refreshing leaves stale content.
// ============================================================================

/**
 * Refreshes every page that lists or filters proposals: the homepage
 * (Recently Added strip + live city counters), the main /proposals browse
 * page (incl. the Featured carousel + deduplicated grid), and every
 * city/caste/sect/profession/marital-status category page, city+gender
 * page, and overseas country page — all in one call.
 *
 * Deliberately broad on purpose: 'page' as the second argument revalidates
 * every instance of that dynamic route (e.g. every city slug at once), not
 * just one. This is intentionally a little wider than "just the one city
 * that changed" — a write is rare enough that the extra refresh cost is
 * negligible, and it removes any risk of missing a page that should have
 * been included.
 *
 * Call this after: a Featured slot is booked or cancelled, a proposal is
 * created/edited/paused/resumed/deleted, or an admin changes a
 * general-settings value that affects what's shown (e.g. max_featured_general,
 * max_featured_per_city).
 */
export async function revalidateListings(): Promise<void> {
  revalidatePath('/');
  revalidatePath('/proposals');
  revalidatePath('/proposals/[slug]', 'page');
  revalidatePath('/proposals/[slug]/[gender]', 'page');
  revalidatePath('/proposals/overseas/[country]', 'page');
}

/**
 * Refreshes one specific person's profile page. Cheap and precise — always
 * safe to call alongside revalidateListings() whenever you know exactly
 * which proposal changed.
 *
 * @param proposalNumber - the public-facing number used in the URL
 *   (joronline.com/profile/{proposalNumber}) — NOT the internal uuid `id`.
 */
export async function revalidateProfile(proposalNumber: number | string): Promise<void> {
  revalidatePath(`/profile/${proposalNumber}`);
}
