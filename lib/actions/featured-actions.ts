'use server';

// Server Actions for the Featured Post system. These replace the old
// pattern of calling supabase.rpc() directly from the browser — moving the
// write server-side is what makes instant cache revalidation possible (see
// lib/actions/revalidate-write.ts for why). The actual booking/cancelling
// logic itself is unchanged: this is a thin wrapper around the exact same
// RPCs (book_featured_slot_with_credit, cancel_featured_boost), returning
// the exact same { data, error } shape the calling components already
// expect — so no behavior changes for the user, only where the call runs.
//
// ⚠️ Adding a new Featured-related write? Call revalidateListings() from
// lib/actions/revalidate-write.ts at the end, same as below. Do not call
// revalidatePath directly from this file — see that file for why.

import { supabase } from '@/lib/supabase';
import { revalidateListings } from './revalidate-write';

export async function bookFeaturedSlotAction(params: {
  p_cnic: string;
  p_city: string;
  p_date: string;
}): Promise<{ data: { success?: boolean; shifted?: boolean; booked_date?: string; error?: string } | null; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc('book_featured_slot_with_credit', params);

  // Only refresh cached pages if the booking actually succeeded — a failed
  // or errored booking changed nothing publicly visible, so there's
  // nothing to invalidate.
  if (data?.success) {
    await revalidateListings();
  }

  return { data, error };
}

export async function cancelFeaturedBoostAction(params: {
  p_cnic: string;
  p_boost_id: string;
}): Promise<{ data: { success?: boolean; error?: string } | null; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc('cancel_featured_boost', params);

  if (data?.success) {
    await revalidateListings();
  }

  return { data, error };
}
