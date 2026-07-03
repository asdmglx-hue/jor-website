import { Proposal } from './supabase';
import { supabase } from './supabase';

const SESSION_KEY = 'er_user';

export function saveSession(proposal: Proposal) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(proposal));
}

export function getSession(): Proposal | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

export function getSavedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('er_saved') || '[]'); } catch { return []; }
}

export function toggleSaved(id: string): string[] {
  const ids = getSavedIds();
  const idx = ids.indexOf(id);
  const nowSaved = idx < 0;
  if (idx >= 0) ids.splice(idx, 1); else ids.push(id);
  localStorage.setItem('er_saved', JSON.stringify(ids));

  // Sync to the database in the background if logged in, so saved proposals
  // survive clearing browser history/localStorage — mirrors the mobile app's
  // saved_proposals table exactly (not just a local-only cache).
  const session = getSession();
  if (session?.id) {
    if (nowSaved) {
      supabase.from('saved_proposals')
        .upsert({ user_proposal_id: session.id, saved_proposal_id: id }, { onConflict: 'user_proposal_id,saved_proposal_id' })
        .then(() => {});
    } else {
      supabase.from('saved_proposals')
        .delete()
        .eq('user_proposal_id', session.id)
        .eq('saved_proposal_id', id)
        .then(() => {});
    }
  }
  return ids;
}

// Pulls the authoritative saved list from the database and refreshes the
// local cache — call this once a logged-in session is detected (e.g. on
// app load), so saved proposals reappear even after localStorage was wiped.
export async function syncSavedFromServer(userProposalId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('saved_proposals')
      .select('saved_proposal_id')
      .eq('user_proposal_id', userProposalId);
    if (error || !data) return getSavedIds();
    const ids = (data as { saved_proposal_id: string }[]).map(r => r.saved_proposal_id);
    localStorage.setItem('er_saved', JSON.stringify(ids));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('jor:saved-synced'));
    return ids;
  } catch {
    return getSavedIds();
  }
}

export function getNotInterestedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('er_not_interested') || '[]'); } catch { return []; }
}

export function addNotInterested(id: string): string[] {
  const ids = getNotInterestedIds();
  if (!ids.includes(id)) ids.push(id);
  localStorage.setItem('er_not_interested', JSON.stringify(ids));
  return ids;
}
