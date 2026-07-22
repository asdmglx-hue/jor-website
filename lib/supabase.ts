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
  degree_title_2?: string;
  institute_2?: string;
  degree_title_3?: string;
  institute_3?: string;
  profession: string;
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
  open_to_polygamy?: string;
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
  city?: string;
  overseas?: boolean;
  country?: string;
  caste?: string;
  sect?: string;
  minAge?: number;
  maxAge?: number;
  education?: string;
  profession?: string;
  maritalStatus?: string;
  homeType?: string;
  minHeight?: number;
  maxHeight?: number;
  openToPolygamy?: string;
  search?: string;
  // "New / 1 Month / 2 Months / 3+ Months" time filter — posted_at bounds,
  // ISO strings. Mirrors the mobile app's chip-based date filter exactly
  // (group_feed_screen.dart's _chipDateRange()), so results agree between
  // web and mobile for the same selection.
  postedAfter?: string;
  postedBefore?: string;
};


const PROFESSION_GROUPS: Record<string, string[]> = {
  'Healthcare': ['Doctor','General Physician','Dentist','Dermatologist','Pediatrician','Orthopedic Surgeon','Surgeon','ENT Specialist','Psychiatrist','Psychologist','Radiologist','Pathologist','Nurse','Nutritionist','Physiotherapist','Dental Assistant','Lab Technician','Pharmacist','Ultrasound Technician','Medical Representative','Optician','Microbiologist','Biochemist','Biomedical Engineer','Genetic Engineer'],
  'Engineering': ['Software Engineer','Civil Engineer','Mechanical Engineer','Electrical Engineer','Electronics Engineer','Chemical Engineer','Aeronautical Engineer','Agricultural Engineer','Automobile Engineer','Computer Engineer','Telecom Engineer','Textile Engineer','Industrial Engineer','Flight Engineer','Robotics Engineer','Hardware Engineer','Network Engineer','Cloud Engineer','Food Technologist','Quantity Surveyor'],
  'IT & Tech': ['Developer','Frontend Developer','Java Developer','Web Developer','Web Designer','UI Designer','UI/UX Designer','Graphic Designer','Programmer','Data Analyst','Data Scientist','Cyber Security Expert','Information Security Analyst','IT Administrator','IT Support Specialist','Network Administrator','SEO Expert','Digital Marketer','Social Media Manager','Blogger','Content Creator','Copywriter','Freelancer','YouTuber','QA Engineer','Drone Operator'],
  'Education': ['Teacher','School Teacher','Lecturer','Professor','University Professor','Principal','Headmaster','Home Tutor','Coach','Trainer','Qari','Research Scientist','Research Assistant'],
  'Finance & Law': ['Accountant','Chartered Accountant','Financial Advisor','Investment Banker','Tax Consultant','Insurance Agent','Economist','Business Analyst','Lawyer','Advocate','Judge','CSS Officer'],
  'Business & Management': ['Business Owner','General Manager','Operation Manager','Product Manager','Project Manager','HR Manager','Human Resource Officer','Marketing Manager','Sales Executive','Bank Manager','Hotel Manager','Construction Manager','Logistic Manager','Warehouse Manager','Import Export Agent','Property Dealer','Real Estate Agent','Trader','Consultant'],
  'Government & Forces': ['Army Officer','Police Officer','Traffic Police Officer','Government Officer','Administrative Officer','Agriculture Officer','Field Officer','Railway Officer','Naib Qasid','Security Guard','Firefighter'],
  'Arts & Media': ['Photographer','Videographer','Video Editor','Cameraman','Actor','Fashion Model','Model','Television Host','Journalist','Editor','Multimedia Specialist','Animator','Sound Engineer','Music Teacher','Influencer'],
  'Skilled Trades': ['Electrician','Plumber','Carpenter','Mason','Brick Mason','Welder','Painter','Auto Electrician','Mobile Repair Technician','Solar Technician','Technician','Machine Operator','Tailor','Embroidery Worker','Baker','Chef','Barber','Beautician'],
  'Services & Other': ['Driver','Truck Driver','Rider','Delivery Rider','Waiter','Receptionist','Cashier','Shopkeeper','Call Center Agent','Social Worker','Veterinarian','Farmer','Livestock Farmer','Interior Designer','Event Manager','Sports Coach','Athlete','Virtual Assistant','Scientist','Fashion Designer','Makeup Artist','Businessman','Housewife','Other'],
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
export const PROFILE_DETAIL_COLS = 'id,proposal_number,name,age,gender,city,country,caste,sect,education,institute,degree_title,degree_title_2,degree_title_3,institute_2,institute_3,profession,employment_type,salary_start,salary_end,monthly_income,height_inches,weight_kg,complexion,marital_status,marriage_number,boys,girls,total_kids,has_kids,practice_level,hijab,beard,open_to_polygamy,father_alive,mother_alive,father_occupation,mother_occupation,sisters,brothers,total_siblings,has_siblings,family_type,home_type,house_size,has_car,car_name,has_generator,has_solar,has_servant,other_property,has_other_property,looking_for,about,languages,smokes,drinks,physically_active,has_disability,disability_details,contact_phone,contact_phone_2,phone_verified,profile_photo_url,posted_at,updated_at,status,subscription_tier,is_boosted,location,featured_credits_purchased,featured_credits_used';
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
export async function fetchFeaturedForCarousel(): Promise<Proposal[]> {
  const { data: settingRow } = await supabase
    .from('app_settings').select('value').eq('key', 'max_featured_general').maybeSingle();
  const max = Number(settingRow?.value) || 20;

  const { data } = await supabase
    .from('proposals')
    .select(CARD_COLS)
    .eq('status', 'active')
    .or(notExpiredFilter())
    .eq('is_boosted', true)
    .order('posted_at', { ascending: false })
    .limit(max);
  return (data || []) as Proposal[];
}

export async function fetchProposals(filters: FilterState = {}, page = 0, pageSize = 16): Promise<{ proposals: Proposal[]; total: number }> {
  // The "general proposal screen" is specifically the unfiltered/all-Pakistan
  // view — no specific city and not the overseas/country view. Featured
  // showcasing for that view now lives entirely in the sliding carousel
  // (see FeaturedCarousel component) — this main list just orders by
  // newest-first, same as "Recently Added". City/overseas-filtered views
  // keep boosting real is_boosted profiles to the top, unaffected — that
  // list is already small thanks to the per-city cap.
  const isGeneralView = !filters.city && !filters.overseas;

  // A profile that bought a Featured slot FOR this specific city should
  // show up here (boosted to the top via is_boosted) even if their own
  // registered city is somewhere else — buying "Featured in Gujrat" should
  // actually mean something when someone browses Gujrat, not just boost
  // them in the unrelated general feed. Fetch which profiles currently
  // have an active (not yet expired) boost for exactly this city first.
  let boostedForCityIds: string[] = [];
  if (filters.city && !filters.overseas) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: activeBoosts } = await supabase
      .from('featured_boosts')
      .select('user_id')
      .eq('city', filters.city)
      .eq('is_used', false)
      .lte('scheduled_date', now.toISOString())
      .gt('scheduled_date', dayAgo.toISOString());
    boostedForCityIds = (activeBoosts || []).map(b => b.user_id as string);
  }

  // Same idea for an overseas country — a slot can now be booked for a
  // country too (see components/FeaturedBookModal.tsx's Pakistan/Overseas
  // location step), and featured_boosts.city stores that country name
  // identically to how it stores a Pakistani city, so this is the exact
  // same lookup, just keyed on filters.country instead.
  let boostedForCountryIds: string[] = [];
  if (filters.overseas && filters.country) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: activeBoosts } = await supabase
      .from('featured_boosts')
      .select('user_id')
      .eq('city', filters.country)
      .eq('is_used', false)
      .lte('scheduled_date', now.toISOString())
      .gt('scheduled_date', dayAgo.toISOString());
    boostedForCountryIds = (activeBoosts || []).map(b => b.user_id as string);
  }

  let query = supabase
    .from('proposals')
    .select(CARD_COLS, { count: 'exact' })
    .eq('status', 'active')
    .or(notExpiredFilter());
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
    if (filters.country) {
      query = boostedForCountryIds.length > 0
        ? query.or(`country.eq.${filters.country},id.in.(${boostedForCountryIds.join(',')})`)
        : query.eq('country', filters.country);
    }
  } else if (filters.city) {
    query = boostedForCityIds.length > 0
      ? query.or(`city.eq.${filters.city},id.in.(${boostedForCityIds.join(',')})`)
      : query.eq('city', filters.city);
  }
  if (filters.caste) query = query.eq('caste', filters.caste);
  if (filters.sect) query = query.eq('sect', filters.sect);
  if (filters.education) query = query.eq('education', filters.education);
  if (filters.maritalStatus) query = query.eq('marital_status', filters.maritalStatus);
  if (filters.minAge) query = query.gte('age', filters.minAge);
  if (filters.maxAge) query = query.lte('age', filters.maxAge);
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,profession.ilike.%${filters.search}%`);
  if (filters.profession) {
    const profs = PROFESSION_GROUPS[filters.profession];
    if (profs) {
      query = query.in('profession', profs);
    } else {
      query = query.eq('profession', filters.profession);
    }
  }
  if (filters.homeType) query = query.eq('home_type', filters.homeType);
  if (filters.minHeight) query = query.gte('height_inches', filters.minHeight);
  if (filters.maxHeight) query = query.lte('height_inches', filters.maxHeight);
  if (filters.openToPolygamy) query = query.eq('open_to_polygamy', filters.openToPolygamy);
  if (filters.postedAfter) query = query.gte('posted_at', filters.postedAfter);
  if (filters.postedBefore) query = query.lte('posted_at', filters.postedBefore);

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
  const [cityCounts, casteCounts, sectCounts, maritalCounts, professionCounts] = await Promise.all([
    fetchCategoryCounts('city'),
    fetchCategoryCounts('caste'),
    fetchCategoryCounts('sect'),
    fetchCategoryCounts('marital_status'),
    fetchCategoryCounts('profession'),
  ]);
  const countsByColumn: Record<string, Record<string, number>> = {
    city: cityCounts, caste: casteCounts, sect: sectCounts, marital_status: maritalCounts, profession: professionCounts,
  };
  return CATEGORY_ENTRIES.filter(e => (countsByColumn[e.dbColumn]?.[e.value] ?? 0) >= MIN_CATEGORY_PROFILES);
}

// Same idea for overseas countries — not a fixed list like the above, so
// this reads real counts fresh rather than filtering a constant array.
export async function getQualifyingCountries(): Promise<{ value: string; slug: string }[]> {
  const counts = await fetchCountryCounts();
  return Object.entries(counts)
    .filter(([, count]) => count >= MIN_CATEGORY_PROFILES)
    .map(([value]) => ({ value, slug: slugify(value) }));
}

// Preview list of proposals matching one category filter — capped, since a
// city like Lahore could have hundreds; the full interactive /proposals
// search page is where deeper browsing happens. Real content either way.
export async function fetchProposalsForCategory(
  dbColumn: 'city' | 'caste' | 'sect' | 'marital_status' | 'profession' | 'country',
  value: string,
  limit = 24,
  extra?: { gender?: string }
): Promise<Proposal[]> {
  // Same "boosted for this specific location" inclusion as fetchProposals —
  // a profile that bought a Featured slot FOR this city (or, now, this
  // overseas country) should show up (and float to the top) on that
  // location's dedicated page too, even if their own registered
  // city/country differs. caste/sect/profession pages don't have a
  // matching concept — only city and country do, since only those two
  // can actually be booked as a Featured location (see
  // components/FeaturedBookModal.tsx's Pakistan/Overseas location step).
  let boostedForCityIds: string[] = [];
  if (dbColumn === 'city' || dbColumn === 'country') {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: activeBoosts } = await supabase
      .from('featured_boosts')
      .select('user_id')
      .eq('city', value)
      .eq('is_used', false)
      .lte('scheduled_date', now.toISOString())
      .gt('scheduled_date', dayAgo.toISOString());
    boostedForCityIds = (activeBoosts || []).map(b => b.user_id as string);
  }

  let query = supabase
    .from('proposals')
    .select(CARD_COLS)
    .eq('status', 'active')
    .or(notExpiredFilter())
    .order('is_boosted', { ascending: false })
    .order('posted_at', { ascending: false })
    .limit(limit);

  query = boostedForCityIds.length > 0
    ? query.or(`${dbColumn}.eq.${value},id.in.(${boostedForCityIds.join(',')})`)
    : query.eq(dbColumn, value);

  if (extra?.gender) query = query.eq('gender', extra.gender);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as Proposal[];
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
export function phoneDisplay(phone: string): string {
  const trimmed = phone.trim();
  const isPakistani = trimmed.startsWith('+92') || !trimmed.startsWith('+');
  if (!isPakistani) return trimmed; // other countries — leave exactly as stored

  const localDigits = trimmed.replace(/^\+?92/, '').replace(/\D/g, '').replace(/^0+/, '');
  if (!localDigits) return trimmed;
  return `+92 ${localDigits.slice(0, 3)} ${localDigits.slice(3)}`;
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

export async function fetchBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data } = await supabase
    .from('blog_posts')
    .select(BLOG_COLS)
    .eq('slug', slug)
    .eq('is_published', true)
    .lte('published_at', new Date().toISOString())
    .maybeSingle();
  return (data as BlogPost | null) || null;
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
