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
    p_data: { ...data, posted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  });

  if (error || !result?.id) {
    return { success: false, error: error?.message || 'Failed to submit proposal' };
  }

  // Notify the admin device (fire-and-forget) — unchanged from the
  // original implementation.
  supabase.functions.invoke('notify-status-change', {
    body: { type: 'new_order', proposal_id: result.id, name: data.name, city: data.city },
  }).catch(() => {});

  await revalidateListings();

  return { success: true, id: result.id };
}
