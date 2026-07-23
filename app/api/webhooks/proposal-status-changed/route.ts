import { getCloudflareContext } from '@opennextjs/cloudflare';
import { revalidateListings, revalidateProfile } from '@/lib/actions/revalidate-write';

// Receives a ping from a Supabase Database Webhook the instant something
// changes that this website can't react to on its own, because the write
// happened outside this codebase entirely (the Admin app, a direct SQL
// change, etc.) — closing the gap the on-demand revalidation work
// (lib/actions/*) can't reach, since that only covers writes that go
// through THIS site's own Server Actions.
//
// Two event shapes are accepted, both sharing this one endpoint/secret
// rather than duplicating a second webhook route:
//
//   1. { proposal_number, old_status, new_status } — a specific
//      proposal's status/subscription_tier/etc. changed (see the
//      on_proposal_change trigger in Supabase). Covers admin
//      approval/rejection/pause AND redeem_activation_code (which
//      changes status + subscription_tier — no separate wiring needed
//      for that RPC specifically, this trigger already watches both
//      columns it touches).
//   2. { setting_key } — an admin_upsert_setting change to
//      max_featured_general or max_featured_per_city (see the
//      on_admin_setting_change trigger). No specific profile is
//      involved, so this just refreshes listing pages generally.
//
// ⚠️ This endpoint is protected by a shared secret (PROPOSAL_WEBHOOK_SECRET),
// NOT by Supabase auth — anyone who knows the URL could otherwise trigger a
// revalidation. Revalidation itself is harmless/cheap, but the secret check
// still guards against random internet noise hitting this route. The same
// secret value must be set in every Supabase trigger function that calls
// this endpoint, and here, as a Cloudflare Worker Variable named
// PROPOSAL_WEBHOOK_SECRET (Workers & Pages → jor-website → Settings →
// Variables and secrets — this project's setup requires plain Variable,
// not Secret type, for it to actually persist — see wrangler.jsonc's
// keep_vars comment for the full story on why).

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    // @ts-expect-error — PROPOSAL_WEBHOOK_SECRET is a Cloudflare Worker variable, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    const expectedSecret = env.PROPOSAL_WEBHOOK_SECRET;

    const providedSecret = request.headers.get('x-webhook-secret');
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = await request.json().catch(() => null) as {
      proposal_number?: number | string;
      old_status?: string;
      new_status?: string;
      setting_key?: string;
    } | null;

    if (payload?.proposal_number) {
      // Broad on purpose, same reasoning as every other write action: a
      // status/subscription_tier change can affect whether this profile
      // appears on listing pages at all, so refresh everything, plus the
      // one specific profile page we know changed.
      await revalidateListings();
      await revalidateProfile(payload.proposal_number);
      return jsonResponse({ success: true }, 200);
    }

    if (payload?.setting_key) {
      // A cap/limit changed (e.g. max_featured_per_city) — no specific
      // profile to target, just refresh the listing pages that display
      // based on that cap.
      await revalidateListings();
      return jsonResponse({ success: true }, 200);
    }

    return jsonResponse({ error: 'Missing proposal_number or setting_key' }, 400);
  } catch {
    return jsonResponse({ error: 'Webhook processing failed' }, 500);
  }
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
