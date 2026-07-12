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
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A genuinely valid session always has at least a name and a cnic —
    // if either is missing, this is stale/corrupted data (e.g. from an
    // interrupted save), not a real login. Treating it as logged-out
    // here, rather than rendering it, is what stops a broken cached
    // session from ever showing a blank/broken account page again.
    if (!parsed || !parsed.name || !parsed.cnic) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

// A logged-in man should only ever browse women's proposals and vice
// versa — matches the mobile app's identical lockedGender feature
// (group_feed_screen.dart / filter_sheet.dart). Admin sessions (id
// starts with 'admin:') and logged-out visitors are unrestricted, same
// as mobile. Returns the gender the feed/filter should be locked to, or
// null if nothing should be locked.
export function getLockedGenderFilter(): 'Male' | 'Female' | null {
  const session = getSession();
  if (!session) return null;
  if (session.id?.startsWith('admin:')) return null;
  if (session.gender !== 'Male' && session.gender !== 'Female') return null;
  return session.gender === 'Male' ? 'Female' : 'Male';
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
  // Same reasoning as the proposals/featured_boosts guard — an admin's
  // "admin:<uuid>" id was never a real proposal id, so it can't be used
  // in saved_proposals.user_proposal_id (a real uuid column) either.
  if (session?.id && !session.id.startsWith('admin:')) {
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
  if (userProposalId.startsWith('admin:')) return getSavedIds();
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

const NOT_INTERESTED_KEY = 'er_not_interested';
const NOT_INTERESTED_DAYS = 30;
type NotInterestedMap = Record<string, number>; // proposal id -> dismissed-at timestamp (ms)

function getNotInterestedMap(): NotInterestedMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(NOT_INTERESTED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Back-compat: older versions stored a flat string[] with no expiry.
    // Treat those as dismissed right now, so they still get a fresh 30-day window.
    if (Array.isArray(parsed)) {
      const now = Date.now();
      const map: NotInterestedMap = {};
      parsed.forEach((id: string) => { map[id] = now; });
      return map;
    }
    return parsed as NotInterestedMap;
  } catch { return {}; }
}

function saveNotInterestedMap(map: NotInterestedMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOT_INTERESTED_KEY, JSON.stringify(map));
}

export function getNotInterestedIds(): string[] {
  const map = getNotInterestedMap();
  const now = Date.now();
  const cutoffMs = NOT_INTERESTED_DAYS * 24 * 60 * 60 * 1000;
  return Object.entries(map).filter(([, dismissedAt]) => now - dismissedAt < cutoffMs).map(([id]) => id);
}

export function addNotInterested(id: string): string[] {
  const map = getNotInterestedMap();
  map[id] = Date.now();
  saveNotInterestedMap(map);

  // Sync to the database in the background if logged in — uses the same
  // append_not_interested RPC and not_interested_ids column your mobile
  // app already relies on, so this survives clearing browser history.
  const session = getSession();
  if (session?.cnic) {
    supabase.rpc('append_not_interested', { p_cnic: session.cnic, p_proposal_id: id }).then(() => {});
  }
  return getNotInterestedIds();
}

// Pulls the authoritative not-interested list from the database and
// refreshes the local cache — call this once a logged-in session is
// detected, so dismissed proposals stay hidden even after localStorage
// was wiped. IDs newly seen from the server start a fresh 30-day timer;
// IDs the website already had a local timestamp for keep that timestamp.
export async function syncNotInterestedFromServer(cnic: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('not_interested_ids')
      .eq('cnic', cnic)
      .maybeSingle();
    if (error || !data) return getNotInterestedIds();
    const ids = (data.not_interested_ids as string[] | null) || [];
    const map = getNotInterestedMap();
    const now = Date.now();
    ids.forEach(id => { if (!(id in map)) map[id] = now; });
    saveNotInterestedMap(map);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('jor:not-interested-synced'));
    return getNotInterestedIds();
  } catch {
    return getNotInterestedIds();
  }
}
