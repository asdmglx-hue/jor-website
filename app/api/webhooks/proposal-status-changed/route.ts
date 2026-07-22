import { getCloudflareContext } from '@opennextjs/cloudflare';
import { revalidateListings, revalidateProfile } from '@/lib/actions/revalidate-write';

// Receives a ping from a Supabase Database Webhook (see the
// on_proposal_status_change trigger + notify_website_on_proposal_status_change
// function in the Supabase project) the instant a proposal's `status`
// column actually changes — most notably admin approval (pending -> active),
// but also rejection/removal/pause from the Admin app.
//
// This is what makes admin-driven visibility changes instant, closing the
// one gap the on-demand revalidation work (lib/actions/*) couldn't reach on
// its own — the Admin app is a separate Flutter codebase that can't call
// this site's Server Actions directly, so Supabase notifies this endpoint
// instead, and this endpoint is the one that calls the same doorway
// functions every other write action already uses.
//
// ⚠️ This endpoint is protected by a shared secret (PROPOSAL_WEBHOOK_SECRET),
// NOT by Supabase auth — anyone who knows the URL could otherwise trigger a
// revalidation. Revalidation itself is harmless/cheap, but the secret check
// still guards against random internet noise hitting this route. The same
// secret value must be set in the Supabase trigger function
// (notify_website_on_proposal_status_change) and here, as a Cloudflare
// Worker secret named PROPOSAL_WEBHOOK_SECRET (Workers & Pages →
// jor-website → Settings → Variables and Secrets → add secret — NOT a
// plain Variable, since it must not be visible in the dashboard/git).

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    // @ts-expect-error — PROPOSAL_WEBHOOK_SECRET is a Cloudflare Worker secret, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    const expectedSecret = env.PROPOSAL_WEBHOOK_SECRET;

    const providedSecret = request.headers.get('x-webhook-secret');
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = await request.json().catch(() => null) as {
      proposal_number?: number | string;
      old_status?: string;
      new_status?: string;
    } | null;

    if (!payload?.proposal_number) {
      return jsonResponse({ error: 'Missing proposal_number' }, 400);
    }

    // Broad on purpose, same reasoning as every other write action: a
    // status change can affect whether this profile appears on listing
    // pages at all (e.g. pending -> active), so refresh everything, plus
    // the one specific profile page we know changed.
    await revalidateListings();
    await revalidateProfile(payload.proposal_number);

    return jsonResponse({ success: true }, 200);
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
