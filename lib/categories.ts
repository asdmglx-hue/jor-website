// Powers the single-dimension SEO pages: /proposals/{city|caste|sect|
// maritalStatus|profession} and /proposals/overseas/{country}. All five
// non-country categories share the same URL shape (/proposals/{slug}), so
// this resolves a URL slug back to which category + real value it means.

import { CITIES, CASTES, SECTS, MARITAL_STATUSES, PROFESSIONS } from './constants';

export type CategoryType = 'city' | 'caste' | 'sect' | 'maritalStatus' | 'profession';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type CategoryEntry = { type: CategoryType; value: string; slug: string; dbColumn: string };

function buildEntries(): CategoryEntry[] {
  const entries: CategoryEntry[] = [];
  for (const v of CITIES) if (v !== 'Other') entries.push({ type: 'city', value: v, slug: slugify(v), dbColumn: 'city' });
  for (const v of CASTES) if (v !== 'Other') entries.push({ type: 'caste', value: v, slug: slugify(v), dbColumn: 'caste' });
  for (const v of SECTS) if (v !== 'Other') entries.push({ type: 'sect', value: v, slug: slugify(v), dbColumn: 'sect' });
  // 'Single' isn't a distinct search term the way Divorced/Widowed genuinely
  // are — most profiles are single, so a dedicated page adds no real value.
  for (const v of MARITAL_STATUSES) if (v !== 'Single') entries.push({ type: 'maritalStatus', value: v, slug: slugify(v), dbColumn: 'marital_status' });
  for (const v of PROFESSIONS) if (v !== 'Other') entries.push({ type: 'profession', value: v, slug: slugify(v), dbColumn: 'profession' });
  return entries;
}

export const CATEGORY_ENTRIES = buildEntries();

export function resolveCategoryBySlug(slug: string): CategoryEntry | null {
  return CATEGORY_ENTRIES.find(e => e.slug === slug) ?? null;
}

// Human-readable label for page titles, e.g. "Mughal Rishta", "Doctor Rishta".
export function categoryPageTitle(entry: CategoryEntry): string {
  if (entry.type === 'city') return `Rishta in ${entry.value}`;
  return `${entry.value} Rishta`;
}
