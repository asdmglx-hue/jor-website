import { createClient } from '@supabase/supabase-js';
import { normalizeCountry } from './constants';
import { CATEGORY_ENTRIES, CategoryEntry, slugify } from './categories';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Ensures a database call can never hang the build indefinitely. If a
// query doesn't resolve within the given time, this rejects with a clear,
// specific error (naming which query) instead of leaving the whole build
// silently frozen — a stuck request now fails fast and visibly.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms)),
  ]);
}

export type Proposal = {
  id: string;
  proposal_number: number;
  name: string;
  age: number;
  gender: string;
  city: string;
  country?: string;
  deletion_reason?: string;
  deleted_from?: string;
  caste: string;
  sect: string;
  education: string;
  degree_title?: string;
  institute?: string;
  degree_certificate_url?: string;
  degree_title_2?: string;
  institute_2?: string;
  degree_certificate_2_url?: string;
  degree_title_3?: string;
  institute_3?: string;
  degree_certificate_3_url?: string;
  profession: string;
  profession_category?: string;
  employment_type?: string;
  monthly_income?: string;
  salary_start?: number;
  salary_end?: number;
  height_inches: number;
  weight_kg?: number;
  complexion?: string;
  marital_status: string;
  has_kids?: boolean;
  boys?: number;
  girls?: number;

  family_type?: string;
  practice_level?: string;
  hijab?: string;
  beard?: string;
  father_alive?: boolean;
  mother_alive?: boolean;
  father_occupation?: string;
  mother_occupation?: string;
  has_siblings?: boolean;
  sisters?: number;
  brothers?: number;
  home_type?: string;
  house_size?: string;
  has_car?: string;
  car_name?: string;
  has_generator?: boolean;
  has_solar?: boolean;
  has_servant?: boolean;
  has_other_property?: string;
  other_property?: string;
  looking_for?: string;
  about?: string;
  suggested_info?: string;
  marriage_number?: string;
  subscription_tier: 'none' | 'basic' | 'featured';
  subscription_expiry?: string;
  is_boosted: boolean;
  featured_credits_purchased?: number;
  featured_credits_used?: number;
  profile_photo_url?: string;
  posted_at: string;
  updated_at: string;
  status: string;
  languages?: string[];
  contact_phone: string;
  contact_phone_2?: string;
  phone_verified: boolean;
  email_verified?: boolean;
  cnic_verified?: boolean;
  not_interested_ids?: string[];
  cnic?: string;
  cnic_front_url?: string;
  cnic_back_url?: string;
  guardian_cnic_front_url?: string;
  guardian_cnic_back_url?: string;
  education_document_url?: string;
  doc_verification?: Record<string, string>;
  is_doc_verified?: boolean;
  affiliate_code?: string;
  applied_coupon_code?: string;
  coupon_discount_percent?: number;
  has_disability?: boolean;
  disability_details?: string;
  smokes?: boolean;
  drinks?: boolean;
  physically_active?: string;
  location?: string;
  password?: string;
};

export type FilterState = {
  gender?: string;
  city?: string;    // kept for URL/back-compat with single-city links; the
                     // UI now writes to `cities` below for actual filtering
  cities?: string[]; // multi-select — matches the app's city filter, which
                      // has always allowed picking more than one city
  overseas?: boolean;
  pakistan?: boolean;
  country?: string;      // back-compat, superseded by `countries` below
  countries?: string[];  // multi-select, matches the app's overseas country filter
  caste?: string;      // back-compat, superseded by `castes` below
  castes?: string[];   // multi-select, matches the app's caste filter
  sect?: string;       // back-compat, superseded by `sects` below
  sects?: string[];    // multi-select, matches the app's sect filter
  minAge?: number;
  maxAge?: number;
  education?: string;      // back-compat, superseded by `educations` below
  educations?: string[];   // multi-select, matches the app's education filter
  profession?: string;     // back-compat, superseded by `professions` below
  professions?: string[];  // multi-select, stores profession_category values
  maritalStatus?: string;      // back-compat, superseded by `maritalStatuses`
  maritalStatuses?: string[];  // multi-select, matches the app's filter
  homeType?: string;      // back-compat, superseded by `homeTypes` below
  homeTypes?: string[];   // multi-select, matches the app's home type filter
  minHeight?: number;
  maxHeight?: number;
  search?: string;
  // "New / 1 Month / 2 Months / 3+ Months" time filter — posted_at bounds,
  // ISO strings. Mirrors the mobile app's chip-based date filter exactly
  // (group_feed_screen.dart's _chipDateRange()), so results agree between
  // web and mobile for the same selection.
  postedAfter?: string;
  postedBefore?: string;
};


// Columns needed to render a ProposalCard (incl. share text fields)
// Columns for the proposal-card / listing views specifically — kept to
// exactly what ProposalCard.tsx and its parent pages actually read.
// Previously included boys, girls, home_type, education, father_alive,
// mother_alive, brothers, sisters, and a second phone number — none of
// which any listing page ever displays. Those live on the full proposal
// Full-detail column list for the public single-profile view page.
// Deliberately NOT select('*') — the proposals table also holds fields
// that should never reach a public visitor's browser (password, cnic,
// the base64-encoded CNIC/photo images, admin_notes, email, and various
// internal tracking fields). This mirrors exactly what the 'anon' role
// is now granted at the database level, so a query here can never
// silently start requesting something the database will refuse anyway.
export const PROFILE_DETAIL_COLS = 'id,proposal_number,name,age,gender,city,country,caste,sect,education,institute,degree_title,degree_certificate_url,degree_title_2,degree_title_3,institute_2,institute_3,degree_certificate_2_url,degree_certificate_3_url,profession,employment_type,salary_start,salary_end,monthly_income,height_inches,weight_kg,complexion,marital_status,marriage_number,boys,girls,total_kids,has_kids,practice_level,hijab,beard,father_alive,mother_alive,father_occupation,mother_occupation,sisters,brothers,total_siblings,has_siblings,family_type,home_type,house_size,has_car,car_name,has_generator,has_solar,has_servant,other_property,has_other_property,looking_for,about,languages,smokes,drinks,physically_active,has_disability,disability_details,contact_phone,contact_phone_2,phone_verified,profile_photo_url,posted_at,updated_at,status,subscription_tier,subscription_expiry,subscription_start,subscription_status,is_boosted,location,featured_credits_purchased,featured_credits_used,deleted_from,deletion_reason,cnic_front_url,cnic_back_url,guardian_cnic_front_url,guardian_cnic_back_url,education_document_url,doc_verification,is_doc_verified';
// so nothing is lost — this just stops sending them on every card, on
// every browse/category/homepage load, where they were never used.
export const CARD_COLS ='id,proposal_number,name,age,gender,city,country,profession,caste,sect,marital_status,height_inches,about,looking_for,profile_photo_url,posted_at,subscription_tier,is_boosted,contact_phone,status';

// Proposals whose status is still literally 'active' in the DB but whose
// subscription_expiry has already passed are in a brief window where the
// admin app's periodic auto-expire check hasn't caught up and flipped
// status to 'expired' yet. Every public-facing listing/search/count query
// needs this on top of status='active' so an expired subscription doesn't
// keep showing in the feed just because that background job hasn't run.
export function notExpiredFilter(): string {
  return `subscription_expiry.is.null,subscription_expiry.gt.${new Date().toISOString()}`;
}

// Merges a legacy single-value filter field with its new multi-select
// array field into one deduplicated list — supports both old bookmarked
// URLs/links that still pass a single value, and the current UI which
// writes to the array field. Returns [] when neither is set.
function toList(single: string | undefined, arr: string[] | undefined): string[] {
  const out = new Set<string>();
  if (single) out.add(single);
  for (const v of arr || []) if (v) out.add(v);
  return Array.from(out);
}

// Builds the search OR-group content matching name/city/profession/caste/
// sect/marital status/home type/country/location, plus #code and age
// numeric matching — same fields the app's search matches, kept in sync
// deliberately so the two platforms return the same results for the same
// search text. Returns null when there's nothing to search.
function buildSearchOrGroup(search: string): string | null {
  // Raw PostgREST .or() filter string breaks on commas/parentheses in the
  // value (they're syntax characters in that mini-language), so strip them.
  const safe = search.trim().replace(/[,()]/g, ' ').trim();
  if (!safe) return null;
  const parts = [
    `name.ilike.%${safe}%`,
    `city.ilike.%${safe}%`,
    `location.ilike.%${safe}%`,
    `country.ilike.%${safe}%`,
    `profession.ilike.%${safe}%`,
    `caste.ilike.%${safe}%`,
    `sect.ilike.%${safe}%`,
    `marital_status.ilike.%${safe}%`,
    // home_type only ever holds "Own House" / "Rented House", so this also
    // naturally catches someone just typing "own" or "rented".
    `home_type.ilike.%${safe}%`,
  ];
  // "#3470" means specifically the proposal number, nothing else. A bare
  // number like "25" is ambiguous between an age and a proposal number, so
  // match both — either interpretation is a reasonable thing to have typed.
  const isCodeSearch = safe.startsWith('#');
  const numQuery = isCodeSearch ? safe.substring(1) : safe;
  const numSearch = /^\d+$/.test(numQuery) ? parseInt(numQuery, 10) : null;
  if (numSearch !== null) {
    parts.push(`proposal_number.eq.${numSearch}`);
    if (!isCodeSearch) parts.push(`age.eq.${numSearch}`);
  }
  return parts.join(',');
}

// "New / 1 Month / 2 Months / 3+ Months" time filter — same 5 buckets and
// index order as the mobile app's chip list (minus 'Saved', which the
// website handles separately via its own heart-icon toggle).
export const TIME_CHIPS = ['All', 'New', '1 Month', '2 Months', '3+ Months'];

// Returns the postedAfter/postedBefore ISO bounds for a TIME_CHIPS index.
// Mirrors group_feed_screen.dart's _chipDateRange() exactly (that function's
// cases 0/2/3/4/5 map to this function's 0/1/2/3/4), so "New" / "1 Month" /
// etc. mean precisely the same posted_at window on both platforms.
export function chipDateRange(chip: number): { postedAfter?: string; postedBefore?: string } {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();
  switch (chip) {
    case 1: return { postedAfter: daysAgo(7) };                              // New
    case 2: return { postedAfter: daysAgo(30), postedBefore: daysAgo(7) };   // 1 Month
    case 3: return { postedAfter: daysAgo(60), postedBefore: daysAgo(30) };  // 2 Months
    case 4: return { postedBefore: daysAgo(90) };                           // 3+ Months (open-ended)
    default: return {};                                                     // All
  }
}

// For the sliding Featured carousel — everyone currently boosted, one card
// per person regardless of how many cities they've booked (is_boosted is a
// single column on the person, not per-booking). Capped by the admin's
// max_featured_general setting, though in practice that's expected to be
// set generously high now that the carousel — not a server-side pick —
// is what fairly shows everyone in turn.
// Wrapped in the same withTimeout+try/catch pattern as
// fetchProposalByNumber below (see its comment) — this is called from
// every category page (city, caste, sect, profession, overseas) and the
// main /proposals page, so a transient Supabase hiccup here previously
// threw an unhandled exception and crashed the whole page with a 500
// instead of just rendering without a Featured section. Now it fails
// safe: the carousel simply doesn't render for that request, same as
// the deliberate "zero matches" case already handled below.
export async function fetchFeaturedForCarousel(filters: FilterState = {}): Promise<Proposal[]> {
  try {
    return await withTimeout(fetchFeaturedForCarouselInner(filters), 20000, 'fetchFeaturedForCarousel');
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function fetchFeaturedForCarouselInner(filters: FilterState = {}): Promise<Proposal[]> {
  const { data: settingRow } = await supabase
    .from('app_settings').select('value').eq('key', 'max_featured_general').maybeSingle();
  const maxGeneral = Number(settingRow?.value) || 20;

  // Use per-city limit when a specific city or country is selected
  let max = maxGeneral;
  if (filters.city || (filters.cities && filters.cities.length > 0) || filters.country || (filters.countries && filters.countries.length > 0)) {
    const { data: perCityRow } = await supabase
      .from('app_settings').select('value').eq('key', 'max_featured_per_city').maybeSingle();
    max = Number(perCityRow?.value) || 5;
  }

  // Shows boosted profiles that ALSO match whatever non-location filter(s)
  // are currently active (caste, sect, marital status, etc. — combined
  // with AND, same logic the main results grid uses). If nothing matches,
  // this returns an empty list and the Featured section simply doesn't
  // render for that filter combination — no fallback to a broader,
  // possibly-irrelevant list. City/overseas/country are deliberately never
  // part of this matching — those have their own separate, location-scoped
  // Featured section instead (see fetchProposalsForCategory).
  // IMPORTANT: postgrest's .or() sets a single "or" query parameter —
  // calling .or() more than once on the same query silently OVERWRITES
  // the previous call rather than combining them (the notExpiredFilter()
  // base check below is a real example: it used to get silently dropped
  // whenever search or the "local" location filter also ran, since each
  // called .or() again afterward). getFeatured() elsewhere in this file
  // already worked around this correctly using PostgREST's nested
  // and()/or() operators — same fix applied here: collect every OR-group
  // this query needs, then combine them into exactly ONE .or() call.
  const orGroups: string[] = [notExpiredFilter()];

  let query = supabase
    .from('proposals')
    .select(CARD_COLS)
    .eq('status', 'active')
    .eq('is_boosted', true);

  if (filters.gender) query = query.eq('gender', filters.gender);
  const castesList = toList(filters.caste, filters.castes);
  if (castesList.length > 0) query = query.in('caste', castesList);
  const sectsList = toList(filters.sect, filters.sects);
  if (sectsList.length > 0) query = query.in('sect', sectsList);
  const educationsList = toList(filters.education, filters.educations);
  if (educationsList.length > 0) query = query.in('education', educationsList);
  const maritalStatusesList = toList(filters.maritalStatus, filters.maritalStatuses);
  if (maritalStatusesList.length > 0) query = query.in('marital_status', maritalStatusesList);
  if (filters.minAge) query = query.gte('age', filters.minAge);
  if (filters.maxAge) query = query.lte('age', filters.maxAge);
  if (filters.search) {
    const searchGroup = buildSearchOrGroup(filters.search);
    if (searchGroup) orGroups.push(searchGroup);
  }
  const professionsList = toList(filters.profession, filters.professions);
  if (professionsList.length > 0) query = query.in('profession_category', professionsList);
  const homeTypesList = toList(filters.homeType, filters.homeTypes);
  if (homeTypesList.length > 0) query = query.in('home_type', homeTypesList);
  if (filters.minHeight) query = query.gte('height_inches', filters.minHeight);
  if (filters.maxHeight) query = query.lte('height_inches', filters.maxHeight);

  // Location scoping:
  // - No location filter → show ALL boosted profiles (Pakistan + overseas)
  // - Pakistan selected → local profiles only (no country or Pakistan)
  // - Overseas selected → overseas profiles only
  if (filters.overseas) {
    const countriesList = toList(filters.country, filters.countries);
    if (countriesList.length > 0) {
      query = query.in('country', countriesList);
    } else {
      query = query.not('country', 'is', null).neq('country', '').neq('country', 'Pakistan');
    }
  } else if (filters.pakistan || filters.city || (filters.cities && filters.cities.length > 0)) {
    // Pakistan view — exclude overseas profiles
    orGroups.push('country.is.null,country.eq.,country.eq.Pakistan');
  }
  // No location filter → no country restriction, show all boosted

  query = orGroups.length === 1
    ? query.or(orGroups[0])
    : query.or(`and(${orGroups.map(g => `or(${g})`).join(',')})`);

  query = query.order('posted_at', { ascending: false }).limit(max);

  const { data } = await query;
  return (data || []) as Proposal[];
}

export async function fetchProposals(filters: FilterState = {}, page = 0, pageSize = 16): Promise<{ proposals: Proposal[]; total: number }> {
  // "General" here means no SPECIFIC location was picked — matches
  // ProposalsClient.tsx's isGeneralView exactly (see that comment for the
  // full reasoning): a bare Overseas toggle with no particular country
  // is still general enough for boosted profiles to show separately via
  // the Featured carousel instead of inline here; it only stops being
  // general once an actual city or a specific country narrows it.
  const citiesList = toList(filters.city, filters.cities);
  const isGeneralView = citiesList.length === 0 && !(filters.overseas && (filters.country || (filters.countries && filters.countries.length > 0)));

  // A profile that bought a Featured slot FOR this specific city should
  // show up here (boosted to the top via is_boosted) even if their own
  // registered city is somewhere else — buying "Featured in Gujrat" should
  // actually mean something when someone browses Gujrat, not just boost
  // them in the unrelated general feed. Fetch which profiles currently
  // have an active (not yet expired) boost for any of the selected cities.
  let boostedForCityIds: string[] = [];
  if (citiesList.length > 0 && !filters.overseas) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: activeBoosts } = await supabase
      .from('featured_boosts')
      .select('user_id')
      .in('city', citiesList)
      .eq('is_used', false)
      .lte('scheduled_date', now.toISOString())
      .gt('scheduled_date', dayAgo.toISOString());
    boostedForCityIds = (activeBoosts || []).map(b => b.user_id as string);
  }

  // Same idea for an overseas country — a slot can now be booked for a
  // country too (see components/FeaturedBookModal.tsx's Pakistan/Overseas
  // location step), and featured_boosts.city stores that country name
  // identically to how it stores a Pakistani city, so this is the exact
  // same lookup, just keyed on the selected countries instead.
  const countriesList = toList(filters.country, filters.countries);
  let boostedForCountryIds: string[] = [];
  if (filters.overseas && countriesList.length > 0) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: activeBoosts } = await supabase
      .from('featured_boosts')
      .select('user_id')
      .in('city', countriesList)
      .eq('is_used', false)
      .lte('scheduled_date', now.toISOString())
      .gt('scheduled_date', dayAgo.toISOString());
    boostedForCountryIds = (activeBoosts || []).map(b => b.user_id as string);
  }

  // Same .or()-overwrite issue as fetchFeaturedForCarouselInner above —
  // notExpiredFilter() plus up to two more conditional OR-groups (the
  // boosted-city/country id match, and search) all need to combine into
  // ONE .or() call via nested and()/or(), not three separate .or() calls.
  const orGroups: string[] = [notExpiredFilter()];

  let query = supabase
    .from('proposals')
    .select(CARD_COLS, { count: 'exact' })
    .eq('status', 'active');
  if (isGeneralView) {
    // Already shown in the Featured carousel above — avoid the confusing
    // duplicate of seeing the same person twice on the same page.
    query = query.eq('is_boosted', false).order('posted_at', { ascending: false });
  } else {
    query = query
      .order('is_boosted', { ascending: false })
      .order('subscription_tier', { ascending: false })
      .order('posted_at', { ascending: false });
  }
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  if (filters.gender) query = query.eq('gender', filters.gender);
  if (filters.overseas) {
    query = query.not('country', 'is', null).neq('country', '').neq('country', 'Pakistan');
    if (countriesList.length > 0) {
      if (boostedForCountryIds.length > 0) {
        // Same manual quoting as the city case above — raw PostgREST
        // .in.() syntax needs each value double-quoted when it contains a
        // space (e.g. "United Arab Emirates").
        const quotedCountries = countriesList.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',');
        orGroups.push(`country.in.(${quotedCountries}),id.in.(${boostedForCountryIds.join(',')})`);
      } else {
        query = query.in('country', countriesList);
      }
    }
  } else if (citiesList.length > 0) {
    if (boostedForCityIds.length > 0) {
      // Raw PostgREST .in.() syntax needs each value double-quoted when it
      // contains a space or comma (e.g. "Rahim Yar Khan") — the query
      // builder's own .in() method does this automatically, but this is a
      // hand-built filter string so it needs the same escaping by hand.
      const quotedCities = citiesList.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',');
      orGroups.push(`city.in.(${quotedCities}),id.in.(${boostedForCityIds.join(',')})`);
    } else {
      query = query.in('city', citiesList);
    }
  }
  const castesList = toList(filters.caste, filters.castes);
  if (castesList.length > 0) query = query.in('caste', castesList);
  const sectsList = toList(filters.sect, filters.sects);
  if (sectsList.length > 0) query = query.in('sect', sectsList);
  const educationsList = toList(filters.education, filters.educations);
  if (educationsList.length > 0) query = query.in('education', educationsList);
  const maritalStatusesList = toList(filters.maritalStatus, filters.maritalStatuses);
  if (maritalStatusesList.length > 0) query = query.in('marital_status', maritalStatusesList);
  if (filters.minAge) query = query.gte('age', filters.minAge);
  if (filters.maxAge) query = query.lte('age', filters.maxAge);
  if (filters.search) {
    const searchGroup = buildSearchOrGroup(filters.search);
    if (searchGroup) orGroups.push(searchGroup);
  }
  const professionsList = toList(filters.profession, filters.professions);
  if (professionsList.length > 0) query = query.in('profession_category', professionsList);
  const homeTypesList = toList(filters.homeType, filters.homeTypes);
  if (homeTypesList.length > 0) query = query.in('home_type', homeTypesList);
  if (filters.minHeight) query = query.gte('height_inches', filters.minHeight);
  if (filters.maxHeight) query = query.lte('height_inches', filters.maxHeight);
  if (filters.postedAfter) query = query.gte('posted_at', filters.postedAfter);
  if (filters.postedBefore) query = query.lte('posted_at', filters.postedBefore);

  query = orGroups.length === 1
    ? query.or(orGroups[0])
    : query.or(`and(${orGroups.map(g => `or(${g})`).join(',')})`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { proposals: (data as Proposal[]) || [], total: count || 0 };
}

// Fetches a single proposal at `offset` in the same "most recently posted"
// order as the homepage's Recently Added section — used to backfill a
// replacement card when one gets dismissed as not interested.
export async function fetchRecentProposalAt(offset: number): Promise<Proposal | null> {
  const { data } = await supabase
    .from('proposals')
    .select(CARD_COLS)
    .eq('status', 'active')
    .or(notExpiredFilter())
    .order('posted_at', { ascending: false })
    .range(offset, offset);
  return (data && data[0]) ? (data[0] as Proposal) : null;
}

// Supabase silently caps any query at 1000 rows by default — a query with
// no .range()/.limit() doesn't error when there's more data than that, it
// just quietly returns the first 1000 and stops. This is exactly what
// caused ~171 real, active profiles to go missing from the live site
// without any warning during the build. This helper fetches ALL matching
// rows in batches of 1000, so every function that genuinely needs a
// complete result set (not just a capped preview) can't silently truncate
// again as the site grows past whatever the current count happens to be.
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const BATCH = 1000;
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await withTimeout<{ data: T[] | null; error: unknown }>(buildQuery(from, from + BATCH - 1), 20000, `fetchAllRows(from=${from})`);
    if (error || !data) break;
    all.push(...data);
    if (data.length < BATCH) break; // last batch — fewer rows than requested means we're done
    from += BATCH;
  }
  return all;
}

// ── Cities — fetched from the cities table ────────────────────────────────────
export async function fetchCities(): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('name, province, sort_order')
      .order('sort_order');
    if (error || !data?.length) return {};
    const raw: Record<string, string[]> = {};
    for (const row of data) {
      const p = row.province as string;
      raw[p] = raw[p] ?? [];
      raw[p].push(row.name as string);
    }
    const order = ['Punjab','Sindh','KPK','Balochistan','Islamabad','Gilgit Baltistan','Azad Kashmir'];
    const grouped: Record<string, string[]> = {};
    for (const p of order) { if (raw[p]) grouped[p] = raw[p]; }
    for (const [k, v] of Object.entries(raw)) { if (!grouped[k]) grouped[k] = v; }
    return grouped;
  } catch { return {}; }
}

// ── Active Cities — only cities that have at least one active proposal ────────
export async function fetchActiveCities(): Promise<Record<string, string[]>> {
  try {
    // Step 1: get official cities with province info
    const { data: cityData, error: cityError } = await supabase
      .from('cities')
      .select('name, province');
    if (cityError || !cityData?.length) return {};

    const provinceOf: Record<string, string> = {};
    for (const row of cityData) {
      const name = (row.name as string)?.trim();
      const prov = (row.province as string)?.trim();
      if (name && prov) provinceOf[name] = prov;
    }
    const officialCities = new Set(Object.keys(provinceOf));

    // Step 2: get distinct cities from active proposals (proposals_feed view)
    const { data: feedData, error: feedError } = await supabase
      .from('proposals_feed')
      .select('city');
    if (feedError || !feedData?.length) return {};

    const activeCityNames = new Set(
      feedData.map(r => (r.city as string)?.trim()).filter(Boolean)
    );

    // Step 3: intersection — only official Pakistan cities with active proposals
    const validCities = [...activeCityNames].filter(c => officialCities.has(c));

    // Step 4: group by province, sort alphabetically within each province
    const raw: Record<string, string[]> = {};
    for (const city of validCities) {
      const prov = provinceOf[city];
      raw[prov] = raw[prov] ?? [];
      raw[prov].push(city);
    }
    for (const key of Object.keys(raw)) raw[key].sort();

    // Step 5: fixed province order
    const order = ['Punjab','Sindh','KPK','Balochistan','Islamabad','Gilgit Baltistan','Azad Kashmir'];
    const grouped: Record<string, string[]> = {};
    for (const p of order) { if (raw[p]) grouped[p] = raw[p]; }
    for (const [k, v] of Object.entries(raw)) { if (!grouped[k]) grouped[k] = v; }
    return grouped;
  } catch { return {}; }
}

// ── Active Castes — only castes that have at least one active proposal ────────
export async function fetchActiveCastes(): Promise<Record<string, string[]>> {
  try {
    // Step 1: get official castes with group info
    const { data: casteData, error: casteError } = await supabase
      .from('castes')
      .select('name, group_name');
    if (casteError || !casteData?.length) return {};

    const groupOf: Record<string, string> = {};
    for (const row of casteData) {
      const name = (row.name as string)?.trim();
      const group = (row.group_name as string)?.trim();
      if (name && group) groupOf[name] = group;
    }
    const officialCastes = new Set(Object.keys(groupOf));

    // Step 2: get distinct castes from active proposals (proposals_feed view)
    const { data: feedData, error: feedError } = await supabase
      .from('proposals_feed')
      .select('caste');
    if (feedError || !feedData?.length) return {};

    const activeCasteNames = new Set(
      feedData.map(r => (r.caste as string)?.trim()).filter(Boolean)
    );

    // Step 3: intersection — only official castes with active proposals
    const validCastes = [...activeCasteNames].filter(c => officialCastes.has(c));

    // Step 4: group by region, sort alphabetically within each group
    const raw: Record<string, string[]> = {};
    for (const caste of validCastes) {
      const group = groupOf[caste];
      raw[group] = raw[group] ?? [];
      raw[group].push(caste);
    }
    for (const key of Object.keys(raw)) raw[key].sort();

    // Step 5: fixed group order
    const order = ['Punjab','Sindh','KPK / Pashtun','Kashmir & Northern','Balochistan','Urdu-speaking / Muhajir','General'];
    const grouped: Record<string, string[]> = {};
    for (const g of order) { if (raw[g]) grouped[g] = raw[g]; }
    for (const [k, v] of Object.entries(raw)) { if (!grouped[k]) grouped[k] = v; }
    return grouped;
  } catch { return {}; }
}

// ── Castes — fetched from the castes table (single source of truth) ──────────
export async function fetchCastes(): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await supabase
      .from('castes')
      .select('name, group_name, sort_order, group_order')
      .order('group_order')
      .order('sort_order');
    if (error || !data?.length) return {};
    const raw: Record<string, string[]> = {};
    for (const row of data) {
      const g = row.group_name as string;
      raw[g] = raw[g] ?? [];
      raw[g].push(row.name as string);
    }
    // Fixed group order
    const order = ['Punjab','Sindh','KPK / Pashtun','Kashmir & Northern','Balochistan','Urdu-speaking / Muhajir','General'];
    const grouped: Record<string, string[]> = {};
    for (const g of order) { if (raw[g]) grouped[g] = raw[g]; }
    for (const [k, v] of Object.entries(raw)) { if (!grouped[k]) grouped[k] = v; }
    return grouped;
  } catch { return {}; }
}

// ── Occupations — fetched from the occupations table ─────────────────────────
export async function fetchOccupations(): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await supabase
      .from('occupations')
      .select('name, category, sort_order')
      .order('sort_order');
    if (error || !data?.length) return {};
    const raw: Record<string, string[]> = {};
    for (const row of data) {
      const c = row.category as string;
      raw[c] = raw[c] ?? [];
      raw[c].push(row.name as string);
    }
    const order = ['Healthcare','Engineering','IT & Tech','Education','Finance & Law','Business & Management','Government & Forces','Arts & Media','Skilled Trades','Services & Other','Other'];
    const grouped: Record<string, string[]> = {};
    for (const g of order) { if (raw[g]) grouped[g] = raw[g]; }
    for (const [k, v] of Object.entries(raw)) { if (!grouped[k]) grouped[k] = v; }
    return grouped;
  } catch { return {}; }
}

export async function fetchOverseasCountries(): Promise<string[]> {
  const data = await fetchAllRows<{ country: string }>((from, to) =>
    supabase
      .from('proposals')
      .select('country')
      .eq('status', 'active')
      .or(notExpiredFilter())
      .not('country', 'is', null)
      .neq('country', '')
      .neq('country', 'Pakistan')
      .range(from, to)
  );
  const counts: Record<string, number> = {};
  for (const row of data) {
    const c = row.country;
    counts[c] = (counts[c] || 0) + 1;
  }
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
}

export async function fetchProposalById(id: string): Promise<Proposal | null> {
  const { data, error } = await supabase.from('proposals').select(PROFILE_DETAIL_COLS).eq('id', id).in('status', ['active', 'paused']).single();
  if (error) return null;
  return data as Proposal;
}

// Looks up by the short, shareable proposal_number (e.g. 1822) rather than
// the internal UUID — used for the public /profile/{number} URL scheme.
export async function fetchProposalByNumber(proposalNumber: number): Promise<Proposal | null> {
  try {
    const { data, error } = await withTimeout<{ data: unknown; error: unknown }>(
      supabase.from('proposals').select(PROFILE_DETAIL_COLS).eq('proposal_number', proposalNumber).in('status', ['active', 'paused']).single(),
      20000,
      `fetchProposalByNumber(${proposalNumber})`
    );
    if (error) return null;
    return data as Proposal;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Every currently active/paused proposal's number — used by
// generateStaticParams to pre-render every /profile/{number} page at
// build time (required for output: 'export'). Must fetch ALL of them, not
// just the first 1000 — see fetchAllRows above for why this matters.
export async function fetchAllProposalNumbers(): Promise<number[]> {
  const data = await fetchAllRows<{ proposal_number: number }>((from, to) =>
    supabase.from('proposals').select('proposal_number').in('status', ['active', 'paused']).range(from, to)
  );
  return data.map(r => r.proposal_number);
}

// Counts real profiles per value for one column (e.g. every city, with
// how many active/paused profiles are in each) — one query per column,
// not per value. Used at build time to decide which SEO category pages
// are actually worth generating (see MIN_CATEGORY_PROFILES).
export const MIN_CATEGORY_PROFILES = 2;

// The three functions below mirror the homepage's own server-side
// getStats/getCities/getCountries logic exactly (see app/page.tsx) —
// deliberately duplicated rather than shared, since the server-side
// versions live in a server component file and can't be imported into a
// client component. Used so the homepage's client-side sections (stats,
// city slider, country slider) can check for genuinely fresh data the
// moment the page loads, instead of only ever showing whatever the
// server happened to have cached at build time — the same reasoning
// that already made /proposals always show current data instantly.
//
// All three are designed to fail silently (return null) rather than
// throw — if the fresh check fails for any reason, the caller just
// keeps showing what it already had. Nothing can ever end up blank or
// broken because of this.
export async function fetchLiveHomeStats(): Promise<{ total: number; male: number; female: number } | null> {
  try {
    const [{ count: total }, { count: male }, { count: female }] = await Promise.all([
      supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'active').or(notExpiredFilter()),
      supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'active').or(notExpiredFilter()).eq('gender', 'Male'),
      supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'active').or(notExpiredFilter()).eq('gender', 'Female'),
    ]);
    return { total: total || 0, male: male || 0, female: female || 0 };
  } catch {
    return null;
  }
}

export async function fetchLiveCityCounts(validCities: Set<string>): Promise<{ city: string; count: number }[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_city_counts');
    if (error || !data) return null;
    return (data as { city: string; count: number }[])
      .filter(row => validCities.has(row.city))
      .map(row => ({ city: row.city, count: Number(row.count) }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return null;
  }
}

export async function fetchLiveCountryCounts(): Promise<{ country: string; count: number }[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_proposal_country_counts');
    if (error || !data) return null;
    const counts: Record<string, number> = {};
    for (const row of data as { value: string; cnt: number }[]) {
      const c = normalizeCountry(row.value);
      counts[c] = (counts[c] || 0) + Number(row.cnt);
    }
    return Object.entries(counts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return null;
  }
}

export async function fetchLiveRecentProposals(): Promise<Proposal[] | null> {
  try {
    const { data } = await supabase
      .from('proposals')
      .select(CARD_COLS)
      .eq('status', 'active')
      .or(notExpiredFilter())
      .order('posted_at', { ascending: false })
      .limit(9);
    return (data || []) as Proposal[];
  } catch {
    return null;
  }
}

// NOTE: previously wrapped in unstable_cache to share these calculations
// across all 240 category pages instead of each one recomputing
// independently — reverted after it caused the Cloudflare build itself
// to hang during static generation (the R2-backed cache handler isn't
// attached during the build step, only once actually deployed). Worth
// revisiting with a build-safe caching approach later; for now, plain
// functions so deploys work reliably.
// Counts computed by the database itself (a single GROUP BY per call)
// instead of downloading every matching row and counting it up in
// JavaScript. Same filtering rules as before (active/paused status,
// not-yet-expired subscription) — this only changes how the count is
// computed, not what gets counted; verified to return identical
// results to the old method before this was deployed.
export async function fetchCategoryCounts(dbColumn: 'city' | 'caste' | 'sect' | 'marital_status' | 'profession'): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_proposal_category_counts', { p_column: dbColumn });
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data as { value: string; cnt: number }[]) {
    counts[row.value] = row.cnt;
  }
  return counts;
}

// Same idea, for overseas countries. The database returns raw country
// values with their counts; the small UK/USA/UAE alias-merging logic
// stays in TypeScript (normalizeCountry), applied here to the much
// smaller aggregated result instead of 1000+ individual rows.
export async function fetchCountryCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_proposal_country_counts');
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data as { value: string; cnt: number }[]) {
    const c = normalizeCountry(row.value);
    counts[c] = (counts[c] || 0) + row.cnt;
  }
  return counts;
}

// Which category values (city/caste/sect/maritalStatus/profession) actually
// have enough real profiles to deserve their own SEO page — shared by the
// category page routes AND the main /proposals browse page, so both agree
// on exactly the same set of "this value has a dedicated page" answers.
// Previously duplicated separately in each page file; kept in one place now
// so they can never quietly drift apart from each other.
export async function getQualifyingCategoryEntries(): Promise<CategoryEntry[]> {
  // City qualification now comes from the same shared get_qualifying_cities
  // RPC the mobile app's Featured-booking picker calls — this is what
  // keeps "which cities have their own page" and "which cities the
  // mobile app offers to book Featured in" from ever disagreeing again
  // (they previously could, since each computed this independently).
  // Caste/sect/marital-status/profession aren't part of that mobile
  // location-picker concern, so they're untouched — still computed the
  // same way as before.
  const [casteCounts, sectCounts, maritalCounts, professionCounts, qualifyingCitiesRes] = await Promise.all([
    fetchCategoryCounts('caste'),
    fetchCategoryCounts('sect'),
    fetchCategoryCounts('marital_status'),
    fetchCategoryCounts('profession'),
    supabase.rpc('get_qualifying_cities'),
  ]);
  const qualifyingCityNames = new Set(
    ((qualifyingCitiesRes.data || []) as { city: string }[]).map(row => row.city)
  );
  const countsByColumn: Record<string, Record<string, number>> = {
    caste: casteCounts, sect: sectCounts, marital_status: maritalCounts, profession: professionCounts,
  };
  return CATEGORY_ENTRIES.filter(e => {
    if (e.dbColumn === 'city') return qualifyingCityNames.has(e.value);
    return (countsByColumn[e.dbColumn]?.[e.value] ?? 0) >= MIN_CATEGORY_PROFILES;
  });
}

// Same idea for overseas countries — now calls the same shared
// get_qualifying_countries RPC the mobile app's Featured-booking picker
// uses, instead of independently recomputing "which countries qualify"
// from a separate client-side count. Same reasoning as the city change
// just above.
export async function getQualifyingCountries(): Promise<{ value: string; slug: string }[]> {
  const { data } = await supabase.rpc('get_qualifying_countries');
  return ((data || []) as { country: string }[]).map(row => ({ value: row.country, slug: slugify(row.country) }));
}

// Preview list of proposals matching one category filter — capped, since a
// city like Lahore could have hundreds; the full interactive /proposals
// search page is where deeper browsing happens. Real content either way.
// Wrapped the same way as fetchFeaturedForCarousel/fetchProposalByNumber
// above — every /proposals/{category} page (city, caste, sect, marital
// status, profession, overseas country) depends on this one call, so an
// unprotected network hiccup here was a direct path to a 500 on any of
// those pages. On failure this now returns an empty result, which the
// caller (app/proposals/[slug]/page.tsx) already treats as "no matches"
// and resolves via its own notFound() — i.e. a clean 404 instead of a
// crash, exactly like the profile page's existing behavior.
export async function fetchProposalsForCategory(
  dbColumn: 'city' | 'caste' | 'sect' | 'marital_status' | 'profession' | 'country',
  value: string,
  limit = 24,
  extra?: { gender?: string }
): Promise<{ proposals: Proposal[]; featured: Proposal[] }> {
  try {
    return await withTimeout(fetchProposalsForCategoryInner(dbColumn, value, limit, extra), 20000, `fetchProposalsForCategory(${dbColumn}=${value})`);
  } catch (e) {
    console.error(e);
    return { proposals: [], featured: [] };
  }
}

async function fetchProposalsForCategoryInner(
  dbColumn: 'city' | 'caste' | 'sect' | 'marital_status' | 'profession' | 'country',
  value: string,
  limit = 24,
  extra?: { gender?: string }
): Promise<{ proposals: Proposal[]; featured: Proposal[] }> {
  // A profile that bought a Featured slot FOR this city (or overseas
  // country) gets its own dedicated "Featured" carousel section on that
  // location's page — same component/heading/slider-threshold as the
  // main Proposals page's carousel (components/FeaturedCarousel.tsx) —
  // rather than just being floated to the top of the regular grid. Only
  // city and country pages have this concept; caste/sect/profession pages
  // don't, since only city/country can actually be booked as a Featured
  // location (see components/FeaturedBookModal.tsx's Pakistan/Overseas
  // location step).
  let featured: Proposal[] = [];
  if (dbColumn === 'city' || dbColumn === 'country') {
    // Read max_featured_per_city from admin settings
    const { data: settingRow } = await supabase
      .from('app_settings').select('value').eq('key', 'max_featured_per_city').maybeSingle();
    const maxPerCity = Number(settingRow?.value) || 5;

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: activeBoosts } = await supabase
      .from('featured_boosts')
      .select('user_id')
      .eq('city', value)
      .eq('is_used', false)
      .lte('scheduled_date', now.toISOString())
      .gt('scheduled_date', dayAgo.toISOString());
    const boostedIds = (activeBoosts || []).map(b => b.user_id as string);

    if (boostedIds.length > 0) {
      let featuredQuery = supabase
        .from('proposals')
        .select(CARD_COLS)
        .eq('status', 'active')
        .or(notExpiredFilter())
        .in('id', boostedIds)
        .limit(maxPerCity);
      if (extra?.gender) featuredQuery = featuredQuery.eq('gender', extra.gender);
      const { data: featuredData } = await featuredQuery;
      featured = (featuredData as Proposal[]) || [];
    }
  }

  // Excludes anyone already shown in the Featured carousel above — same
  // "nobody appears twice on the same page" rule as the main Proposals
  // page's general view.
  const featuredIds = new Set(featured.map(f => f.id));

  let query = supabase
    .from('proposals')
    .select(CARD_COLS)
    .eq('status', 'active')
    .or(notExpiredFilter())
    .eq(dbColumn, value)
    .order('is_boosted', { ascending: false })
    .order('posted_at', { ascending: false })
    .limit(limit);

  if (extra?.gender) query = query.eq('gender', extra.gender);
  const { data, error } = await query;
  if (error || !data) return { proposals: [], featured };

  const proposals = (data as Proposal[]).filter(p => !featuredIds.has(p.id));
  return { proposals, featured };
}

// Login with CNIC + password (matches your Flutter app exactly)
export async function loginWithCnic(cnic: string, password: string): Promise<Proposal | null> {
  const digits = cnic.replace(/-/g, '').trim();
  const hyphenated = `${digits.slice(0,5)}-${digits.slice(5,12)}-${digits.slice(12)}`;

  // Admin accounts (from the admin app's "Create Admin" screen) are checked
  // first. They're real logins backed by the admin_accounts table, not a
  // proposal — so we synthesize a minimal Proposal-shaped session object for
  // them, since the rest of the site (session storage, my-profile page)
  // expects a Proposal. subscription_tier/status are set so every locked-
  // content check across the site (which funnels through isSubscriptionActive)
  // treats this session as fully unlocked.
  const { data: adminRow } = await supabase
    .from('admin_accounts')
    .select('id, name, cnic, password')
    .or(`cnic.eq.${digits},cnic.eq.${hyphenated}`)
    .eq('password', password.trim())
    .maybeSingle();

  if (adminRow) {
    return {
      id: `admin:${adminRow.id}`,
      proposal_number: 0,
      name: adminRow.name || 'Admin',
      age: 0,
      gender: 'Male',
      city: '',
      caste: '',
      sect: '',
      education: '',
      profession: '',
      height_inches: 0,
      marital_status: '',
      cnic: adminRow.cnic,
      password: adminRow.password,
      subscription_tier: 'featured',
      status: 'approved',
    } as Proposal;
  }

  // Regular (non-admin) login now goes through a security-definer RPC too —
  // a raw select here was silently invisible to any proposal that isn't
  // status='active' under the public_view_active_proposals policy (added
  // for the emergency proposals-visibility fix), which meant pending or
  // paused accounts could never log in at all, always reporting "Incorrect
  // CNIC or password" even with the right credentials. The RPC bypasses
  // that restriction while still requiring an exact password match.
  const { data, error } = await supabase.rpc('login_by_cnic', {
    p_cnic: digits,
    p_password: password.trim(),
  });
  // data?.id check is deliberate, not redundant with !data — a Postgres
  // function returning a composite type produces a row where every field
  // is individually null when no match is found, not a true SQL null.
  // That "row of nulls" is still a truthy object in JS, which is exactly
  // what let a wrong password through as a successful login before this
  // was caught. Checking a real field, not just object truthiness, is
  // what actually catches that case.
  if (error || !data || !data.id) return null;
  return data as Proposal;
}

export async function updateProposal(id: string, updates: Partial<Proposal>): Promise<boolean> {
  const { error } = await supabase.from('proposals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

// submitProposal was moved to lib/actions/proposal-actions.ts
// (submitProposalAction) so a successful submission can be triggered
// server-side — see that file and lib/actions/revalidate-write.ts.

// Redeem activation code (calls your existing Supabase RPC)
export async function redeemCode(proposalId: string, code: string): Promise<{ success: boolean; tier?: string; expiry?: string; error?: string }> {
  const { data, error } = await supabase.rpc('redeem_activation_code', {
    p_user_id: proposalId,
    p_code: code.trim().toUpperCase(),
  });
  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; tier?: string; expiry?: string; error?: string };
  return result;
}

export function heightDisplay(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches % 12);
  return `${ft}'${inch}"`;
}

// contact_phone / contact_phone_2 come from several different sources —
// the website's registration form (always saves "+92 ..."), and the admin
// app's manual-add / WhatsApp-AI-import screens (often save a bare local
// number like "0332 4194917", "03324194917" or with odd spacing, no
// country code at all). Every place that DISPLAYS a phone number should
// go through this so the result is always shown the same way:
// "+92 xxx xxxxxxx" — country code, then the 10-digit local number
// (trunk 0 dropped) grouped 3+7, regardless of how it was actually stored.
// Phone number grouping patterns for major diaspora countries.
// Each entry: [dial_code, ...group_sizes] where group sizes sum to the
// expected local digit count. Applied left-to-right after stripping the
// country code. Longer codes must come first to avoid +1 matching +1868.
const PHONE_FORMATS: [string, ...number[]][] = [
  ['+353', 2, 3, 4], // Ireland
  ['+966', 2, 3, 4], // Saudi Arabia
  ['+971', 2, 3, 4], // UAE
  ['+968', 4, 4],    // Oman
  ['+973', 4, 4],    // Bahrain
  ['+974', 4, 4],    // Kuwait (also matches Qatar)
  ['+965', 4, 4],    // Kuwait
  ['+92',  3, 7],    // Pakistan
  ['+64',  2, 3, 4], // New Zealand
  ['+61',  3, 3, 3], // Australia
  ['+49',  3, 7],    // Germany
  ['+47',  3, 2, 3], // Norway
  ['+46',  3, 3, 3], // Sweden
  ['+45',  2, 2, 2, 2], // Denmark
  ['+44',  4, 6],    // UK
  ['+39',  3, 7],    // Italy
  ['+34',  3, 6],    // Spain
  ['+33',  1, 2, 2, 2, 2], // France
  ['+31',  1, 4, 4], // Netherlands
  ['+30',  3, 7],    // Greece
  ['+90',  3, 3, 4], // Turkey
  ['+60',  2, 4, 4], // Malaysia
  ['+1',   3, 3, 4], // USA / Canada
];

function groupDigits(digits: string, groups: number[]): string {
  const parts: string[] = [];
  let pos = 0;
  for (const g of groups) {
    if (pos >= digits.length) break;
    parts.push(digits.slice(pos, pos + g));
    pos += g;
  }
  if (pos < digits.length) parts.push(digits.slice(pos)); // overflow
  return parts.join(' ');
}

export function phoneDisplay(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;

  // Numbers stored with an explicit '+' country code
  if (trimmed.startsWith('+')) {
    for (const [code, ...groups] of PHONE_FORMATS) {
      if (trimmed.startsWith(code)) {
        const local = trimmed.slice(code.length).replace(/\D/g, '').replace(/^0+/, '');
        return `${code} ${groupDigits(local, groups)}`;
      }
    }
    return trimmed; // unknown country code — show as-is
  }

  // Legacy Pakistani numbers stored without '+' (0300... or 92300...)
  const digits = trimmed.replace(/\D/g, '');
  const isPakistani = digits.startsWith('92') || digits.startsWith('0');
  if (isPakistani) {
    const local = digits.replace(/^92/, '').replace(/^0/, '');
    return `+92 ${groupDigits(local, [3, 7])}`;
  }

  return trimmed; // ambiguous — show as-is
}

// The cnic column is always stored as clean digits, no hyphens (enforced
// by a database trigger — see normalize_cnic_before_write) so every RPC
// that looks someone up by CNIC always compares apples to apples. This is
// purely a display-time formatter — "1111111111111" -> "11111-1111111-1"
// — for anywhere a person actually reads their own CNIC. Never write this
// formatted value back to the database; always pass the raw digits.
export function cnicDisplay(cnic: string): string {
  const digits = cnic.replace(/\D/g, '');
  if (digits.length !== 13) return cnic; // unexpected length — show as-is rather than mangle it
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

// Cached once per page load so the frequent, synchronous
// isSubscriptionActive() checks below don't need to hit the database every
// time. Kicked off immediately when this module loads; by the time most
// components actually check subscription status, this has usually already
// resolved. Backed by the admin_accounts table (supports multiple admins,
// created from the admin app's "Create Admin" screen) rather than a single
// hardcoded CNIC, so it stays correct as admins are added/changed/removed.
let cachedAdminCnics: Set<string> = new Set();
if (typeof window !== 'undefined') {
  supabase.from('admin_accounts').select('cnic').then(({ data }) => {
    if (data) cachedAdminCnics = new Set(data.map((r: { cnic: string }) => r.cnic));
  });
}

// ── Featured Post — per-city/date slot availability ─────────────────────────
// Mirrors the mobile app's check exactly (SupabaseService.featuredSlotUsage /
// isFeaturedSlotAvailable in libuser): a city's Featured slots on a given day
// are capped by the admin's 'max_featured_per_city' app_settings value.
// Only already-scheduled/active boosts (featured_boosts, not yet used/
// expired) count as taken — a request that's only been sent over WhatsApp
// and not yet approved by admin does NOT hold a slot, and once a scheduled
// boost is removed (or an active one's window ends and it's marked used) it
// stops counting automatically since this always reads the live table.
export async function featuredSlotUsage(city: string, date: string): Promise<number> {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  try {
    const { count } = await supabase
      .from('featured_boosts')
      .select('id', { count: 'exact', head: true })
      .eq('city', city)
      .eq('is_used', false)
      .gte('scheduled_date', dayStart.toISOString())
      .lt('scheduled_date', dayEnd.toISOString());
    return count || 0;
  } catch (_) {
    // If this can't be read, don't block the user over it.
    return 0;
  }
}

export async function isFeaturedSlotAvailable(city: string, date: string, maxPerCity: number): Promise<boolean> {
  const used = await featuredSlotUsage(city, date);
  return used < maxPerCity;
}

export function isSubscriptionActive(proposal: Proposal): boolean {
  if (proposal.cnic && cachedAdminCnics.has(proposal.cnic)) return true;
  if (proposal.subscription_tier === 'none') return false;
  if (!proposal.subscription_expiry) return false;
  return new Date(proposal.subscription_expiry) > new Date();
}

// ── Blog ──────────────────────────────────────────────────────────────────
// Every field the admin app auto-fills (slug, excerpt, meta_description,
// keywords, read_time_minutes) is computed once at save time there — this
// side just reads whatever ended up in the row.
export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  category: string;
  author: string;
  cover_image_url: string | null;
  read_time_minutes: number;
  published_at: string;
};

const BLOG_COLS = 'id,title,slug,content,excerpt,meta_title,meta_description,keywords,category,author,cover_image_url,read_time_minutes,published_at';

export async function fetchBlogPosts(limit = 50): Promise<BlogPost[]> {
  const { data } = await supabase
    .from('blog_posts')
    .select(BLOG_COLS)
    .eq('is_published', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data || []) as BlogPost[];
}

// Wrapped the same way as fetchProposalByNumber/fetchProposalsForCategory
// above — the blog post page (app/blog/[slug]/page.tsx) already calls
// notFound() when this returns null, so a genuine Supabase hiccup now
// resolves to a clean 404 instead of an unhandled 500.
export async function fetchBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const { data } = await withTimeout(
      supabase
        .from('blog_posts')
        .select(BLOG_COLS)
        .eq('slug', slug)
        .eq('is_published', true)
        .lte('published_at', new Date().toISOString())
        .maybeSingle(),
      20000,
      `fetchBlogPostBySlug(${slug})`
    );
    return (data as BlogPost | null) || null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Sitemap only needs the slug + when it was last meaningfully updated.
export async function fetchAllBlogSlugs(): Promise<{ slug: string; published_at: string }[]> {
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, published_at')
    .eq('is_published', true)
    .lte('published_at', new Date().toISOString());
  return (data || []) as { slug: string; published_at: string }[];
}

// ── Forgot Password CNIC photo upload ────────────────────────────────────────
export async function uploadForgotPasswordCnicPhoto(file: File, cnicDigits: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `forgot-password/${cnicDigits}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('cnic-photos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) return null;
    const { data } = supabase.storage.from('cnic-photos').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}
