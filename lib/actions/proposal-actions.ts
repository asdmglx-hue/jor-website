'use server';

// Server Actions for proposal writes (submit / update / pause / resume /
// delete). Same reasoning as featured-actions.ts: thin wrappers around the
// exact same RPCs, moved server-side so a real change can trigger instant
// cache revalidation instead of waiting on the 5-minute timer.
//
// ⚠️ Adding a new proposal-related write? Call revalidateListings() (and
// revalidateProfile() if you know the proposal_number) from
// lib/actions/revalidate-write.ts — do not call revalidatePath directly
// from this file.
//
// NOTE on submitProposalAction specifically: a brand-new submission is
// created with status 'pending', and pending proposals aren't publicly
// visible yet (see the original comment on submitProposal in
// lib/supabase.ts — the public SELECT policy only shows 'active' rows). So
// revalidating listings here is harmless but won't visibly change anything
// until the submission is later approved. Approval currently happens from
// the separate Admin app (a different Flutter codebase, not touched here)
// — if instant freshness on approval matters later, that's where a
// matching revalidation hook would need to be added, likely via a webhook
// or a scheduled check, since that app can't call this site's Server
// Actions directly.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { supabase, type Proposal } from '@/lib/supabase';
import { revalidateListings, revalidateProfile } from './revalidate-write';

export async function updateOwnProposalAction(params: {
  p_id: string;
  p_updates: Record<string, unknown>;
  proposalNumber?: number | string;
}): Promise<{ data: unknown; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc('update_own_proposal_secure', {
    p_id: params.p_id,
    p_updates: params.p_updates,
  });

  if (data) {
    await revalidateListings();
    if (params.proposalNumber !== undefined) {
      await revalidateProfile(params.proposalNumber);
    }
  }

  return { data, error };
}

// Self-service document verification ("Verify Now").
//
// This MUST go through submit_cnic_verification, exactly like the user app
// does (SupabaseService.submitCnicVerification → same RPC). It is not the
// same thing as writing the five *_url columns via update_own_proposal_secure,
// which is what this site used to do. That older path skipped three steps the
// RPC performs, and each one broke something:
//
//   1. inserts a row into cnic_verification_requests — this is the ONLY thing
//      the Admin app watches to raise the red dot on the Users tab and to fire
//      its realtime channel. Without it a website submission is invisible to
//      the reviewer.
//   2. resets doc_verification[key] to 'pending' for each submitted doc, so a
//      previously *rejected* document is reviewable again and the admin's
//      Approve/Reject buttons reset. Without it the doc stays 'rejected'
//      forever and the member re-uploads in a loop with nothing changing.
//   3. sets is_doc_verified = false, so swapping a document on an already
//      verified profile requires re-approval instead of silently keeping the
//      badge.
//
// The RPC also deletes any existing pending request first (re-submission
// replaces rather than stacks), and coalesces the URLs so omitted documents
// keep whatever is already on the profile.
//
// Only pass URLs that are actually set — the RPC's parameters all default to
// NULL, and it nullif('')s anyway, but omitting them keeps the call identical
// in shape to the app's.
export async function submitCnicVerificationAction(params: {
  p_cnic: string;
  frontUrl?: string;
  backUrl?: string;
  guardianFrontUrl?: string;
  guardianBackUrl?: string;
  educationDocumentUrl?: string;
  proposalNumber?: number | string;
}): Promise<{ ok: boolean; error: string | null }> {
  const rpcParams: Record<string, string> = { p_cnic: params.p_cnic.trim() };
  if (params.frontUrl)            rpcParams.p_front_url               = params.frontUrl;
  if (params.backUrl)             rpcParams.p_back_url                = params.backUrl;
  if (params.guardianFrontUrl)    rpcParams.p_guardian_front_url      = params.guardianFrontUrl;
  if (params.guardianBackUrl)     rpcParams.p_guardian_back_url       = params.guardianBackUrl;
  if (params.educationDocumentUrl) rpcParams.p_education_document_url = params.educationDocumentUrl;

  const { error } = await supabase.rpc('submit_cnic_verification', rpcParams);

  if (error) return { ok: false, error: error.message };

  // The documents themselves are never shown publicly, but is_doc_verified
  // drives the badge on the card and profile page, and this call can turn it
  // off — so the cached pages need refreshing.
  await revalidateListings();
  if (params.proposalNumber !== undefined) {
    await revalidateProfile(params.proposalNumber);
  }

  return { ok: true, error: null };
}

export async function deleteOwnProposalAction(params: {
  p_id: string;
  p_password: string;
  p_reason: string;
}): Promise<{ data: unknown; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc('delete_own_proposal_secure', params);

  // A deleted proposal must disappear from listings immediately — this is
  // the one write where staleness is most visible/awkward (the person just
  // confirmed deletion and left).
  if (data) {
    await revalidateListings();
  }

  return { data, error };
}

export async function submitProposalAction(
  data: Partial<Proposal>
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Identical logic to the original submitProposal() in lib/supabase.ts —
  // moved here, server-side, so it can sit alongside the other write
  // actions. See the note at the top of this file re: why revalidation
  // here has limited visible effect until admin approval.
  const { data: result, error } = await supabase.rpc('submit_proposal_secure', {
    p_data: { ...data, posted_at: new Date().toISOString(), updated_at: new Date().toISOString(), submission_source: 'website' },
  });

  if (error || !result?.id) {
    return { success: false, error: error?.message || 'Failed to submit proposal' };
  }

  // Notify the admin device. Wrapped in ctx.waitUntil() rather than left as
  // a bare fire-and-forget call: on Cloudflare Workers, the request (and
  // any in-flight unawaited work) can be torn down the moment the response
  // is sent — which was silently dropping this notification on some
  // submissions (no error, no log entry, nothing). waitUntil() is
  // Cloudflare's own native primitive for exactly this (more reliable here
  // than next/server's after(), which has a known open bug on this exact
  // adapter — see opennextjs/opennextjs-cloudflare#912). It keeps this
  // work alive for up to 30s after the response is sent, without making
  // the submitting user wait for it.
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(
      supabase.functions.invoke('notify-status-change', {
        body: { type: 'new_order', proposal_id: result.id, name: data.name, city: data.city },
      }).catch(() => {})
    );
  } catch {
    // getCloudflareContext isn't available in every environment (e.g. some
    // local/dev setups) — fall back to the original fire-and-forget call
    // rather than breaking the submission entirely.
    supabase.functions.invoke('notify-status-change', {
      body: { type: 'new_order', proposal_id: result.id, name: data.name, city: data.city },
    }).catch(() => {});
  }

  await revalidateListings();

  return { success: true, id: result.id };
}
