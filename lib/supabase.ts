import { createClient } from '@supabase/supabase-js';
import { normalizeCountry } from './constants';

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
export const CARD_COLS ='id,proposal_number,name,age,gender,city,country,profession,caste,sect,marital_status,height_inches,boys,girls,about,looking_for,profile_photo_url,posted_at,subscription_tier,is_boosted,contact_phone,contact_phone_2,home_type,education,father_alive,mother_alive,brothers,sisters,status';

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

export async function fetchProposals(filters: FilterState = {}, page = 0, pageSize = 16): Promise<{ proposals: Proposal[]; total: number }> {
  let query = supabase
    .from('proposals')
    .select(CARD_COLS, { count: 'exact' })
    .eq('status', 'active')
    .or(notExpiredFilter())
    .order('is_boosted', { ascending: false })
    .order('subscription_tier', { ascending: false })
    .order('posted_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (filters.gender) query = query.eq('gender', filters.gender);
  if (filters.overseas) {
    query = query.not('country', 'is', null).neq('country', '').neq('country', 'Pakistan');
    if (filters.country) query = query.eq('country', filters.country);
  } else if (filters.city) query = query.eq('city', filters.city);
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
  const { data, error } = await supabase.from('proposals').select('*').eq('id', id).in('status', ['active', 'paused']).single();
  if (error) return null;
  return data as Proposal;
}

// Looks up by the short, shareable proposal_number (e.g. 1822) rather than
// the internal UUID — used for the public /profile/{number} URL scheme.
export async function fetchProposalByNumber(proposalNumber: number): Promise<Proposal | null> {
  try {
    const { data, error } = await withTimeout<{ data: unknown; error: unknown }>(
      supabase.from('proposals').select('*').eq('proposal_number', proposalNumber).in('status', ['active', 'paused']).single(),
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
export const MIN_CATEGORY_PROFILES = 5;

export async function fetchCategoryCounts(dbColumn: 'city' | 'caste' | 'sect' | 'marital_status' | 'profession'): Promise<Record<string, number>> {
  const data = await fetchAllRows<Record<string, string | null>>((from, to) =>
    supabase.from('proposals').select(dbColumn).in('status', ['active', 'paused']).or(notExpiredFilter()).range(from, to)
  );
  const counts: Record<string, number> = {};
  for (const row of data) {
    const v = row[dbColumn];
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

// Same idea, for overseas countries (a dynamic list, not a fixed constant).
export async function fetchCountryCounts(): Promise<Record<string, number>> {
  const data = await fetchAllRows<{ country: string | null }>((from, to) =>
    supabase
      .from('proposals')
      .select('country')
      .in('status', ['active', 'paused'])
      .or(notExpiredFilter())
      .not('country', 'is', null)
      .neq('country', '')
      .neq('country', 'Pakistan')
      .neq('country', 'Other')
      .range(from, to)
  );
  const counts: Record<string, number> = {};
  for (const row of data) {
    if (row.country) {
      const c = normalizeCountry(row.country);
      counts[c] = (counts[c] || 0) + 1;
    }
  }
  return counts;
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
  let query = supabase
    .from('proposals')
    .select(CARD_COLS)
    .eq('status', 'active')
    .or(notExpiredFilter())
    .eq(dbColumn, value)
    .order('posted_at', { ascending: false })
    .limit(limit);
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

export async function submitProposal(data: Partial<Proposal>): Promise<{ success: boolean; id?: string; error?: string }> {
  // Goes through a security-definer RPC rather than a raw insert+select —
  // .insert().select().single() implicitly needs the newly-inserted row
  // to pass the SELECT policy (public_view_active_proposals, status =
  // 'active' only), but a brand-new submission is 'pending', so it always
  // failed with "new row violates row-level security policy" before this.
  // Same root cause and same fix as the mobile app's submission flow —
  // this was the one place on the website itself that never got updated
  // to match. The RPC also force-sets status server-side regardless of
  // what's passed in, so a submission can never self-approve.
  const { data: result, error } = await supabase.rpc('submit_proposal_secure', {
    p_data: { ...data, posted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  });
  if (error || !result?.id) return { success: false, error: error?.message || 'Failed to submit proposal' };

  // Notify the admin device (fire-and-forget) — mirrors exactly what the
  // mobile app already does after a successful submission. The website's
  // registration flow never had this wired up at all, which is why a
  // website submission never produced a "New Order" alert even though
  // the exact same submission from the app does. The edge function looks
  // up the admin's registered FCM token itself, so this reaches them even
  // if the admin app is fully closed.
  supabase.functions.invoke('notify-status-change', {
    body: { type: 'new_order', proposal_id: result.id, name: data.name, city: data.city },
  }).catch(() => {});

  return { success: true, id: result.id };
}

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
