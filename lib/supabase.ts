import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Proposal = {
  id: string;
  proposal_number: number;
  name: string;
  age: number;
  gender: string;
  city: string;
  country?: string;
  delete_reason?: string;
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
  cnic?: string;
  cnic_front_url?: string;
  cnic_back_url?: string;
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
  search?: string;
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
export const CARD_COLS ='id,name,age,gender,city,country,profession,caste,sect,marital_status,height_inches,boys,girls,about,looking_for,profile_photo_url,posted_at,subscription_tier,is_boosted,contact_phone,contact_phone_2,home_type,education,father_alive,mother_alive,brothers,sisters,status';

export async function fetchProposals(filters: FilterState = {}, page = 0, pageSize = 16): Promise<{ proposals: Proposal[]; total: number }> {
  let query = supabase
    .from('proposals')
    .select(CARD_COLS, { count: 'exact' })
    .eq('status', 'active')
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

  const { data, count, error } = await query;
  if (error) throw error;
  return { proposals: (data as Proposal[]) || [], total: count || 0 };
}

export async function fetchOverseasCountries(): Promise<string[]> {
  const { data } = await supabase
    .from('proposals')
    .select('country')
    .eq('status', 'active')
    .not('country', 'is', null)
    .neq('country', '')
    .neq('country', 'Pakistan');
  if (!data) return [];
  const counts: Record<string, number> = {};
  for (const row of data) {
    const c = row.country as string;
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
  const { data, error } = await supabase.from('proposals').select('*').eq('proposal_number', proposalNumber).in('status', ['active', 'paused']).single();
  if (error) return null;
  return data as Proposal;
}

// Every currently active/paused proposal's number — used by
// generateStaticParams to pre-render every /profile/{number} page at
// build time (required for output: 'export').
export async function fetchAllProposalNumbers(): Promise<number[]> {
  const { data, error } = await supabase.from('proposals').select('proposal_number').in('status', ['active', 'paused']);
  if (error || !data) return [];
  return (data as { proposal_number: number }[]).map(r => r.proposal_number);
}

// Counts real profiles per value for one column (e.g. every city, with
// how many active/paused profiles are in each) — one query per column,
// not per value. Used at build time to decide which SEO category pages
// are actually worth generating (see MIN_CATEGORY_PROFILES).
export const MIN_CATEGORY_PROFILES = 5;

export async function fetchCategoryCounts(dbColumn: 'city' | 'caste' | 'sect' | 'marital_status' | 'profession'): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('proposals').select(dbColumn).in('status', ['active', 'paused']);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data as Record<string, string | null>[]) {
    const v = row[dbColumn];
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

// Same idea, for overseas countries (a dynamic list, not a fixed constant).
export async function fetchCountryCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('proposals')
    .select('country')
    .in('status', ['active', 'paused'])
    .not('country', 'is', null)
    .neq('country', '')
    .neq('country', 'Pakistan');
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data as { country: string | null }[]) {
    if (row.country) counts[row.country] = (counts[row.country] || 0) + 1;
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
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .or(`cnic.eq.${digits},cnic.eq.${hyphenated}`)
    .eq('password', password.trim())
    .in('status', ['active', 'paused', 'pending', 'approved'])
    .order('posted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as Proposal;
}

export async function updateProposal(id: string, updates: Partial<Proposal>): Promise<boolean> {
  const { error } = await supabase.from('proposals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

export async function submitProposal(data: Partial<Proposal>): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data: result, error } = await supabase
    .from('proposals')
    .insert({ ...data, status: 'pending', posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select('id').single();
  if (error) return { success: false, error: error.message };
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

export function isSubscriptionActive(proposal: Proposal): boolean {
  if (proposal.subscription_tier === 'none') return false;
  if (!proposal.subscription_expiry) return false;
  return new Date(proposal.subscription_expiry) > new Date();
}
