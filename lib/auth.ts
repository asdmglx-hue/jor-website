import { Proposal } from './supabase';

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
  if (idx >= 0) ids.splice(idx, 1); else ids.push(id);
  localStorage.setItem('er_saved', JSON.stringify(ids));
  return ids;
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
