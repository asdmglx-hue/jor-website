'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession, clearSession, getSavedIds, toggleSaved as toggleSavedFn } from '@/lib/auth';
import { fetchProposalById, heightDisplay, Proposal, updateProposal, isSubscriptionActive, supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProposalCard from '@/components/ProposalCard';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(res => { image.onload = res; });
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92));
}

type Tab = 'profile' | 'saved';

function Badge({ children, color = '#534AB7', bg = '#EEEDFE' }: { children: React.ReactNode; color?: string; bg?: string }) {
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{children}</span>;
}

function getStatusLabel(user: Proposal, featuredBoost = false): string {
  const status = user.status;
  if (status === 'deleted') return 'Removed';
  if (status === 'rejected') return 'Rejected';
  if (status === 'pending') return 'Pending';
  if (status === 'paused') return 'Paused';
  // Featured: only when subscription is also active
  if (isSubscriptionActive(user) && (featuredBoost || user.is_boosted || user.subscription_tier === 'featured')) return 'Featured';
  // Active with valid subscription
  if ((status === 'active' || status === 'approved') && isSubscriptionActive(user)) return 'Active';
  // Subscription lapsed
  if (user.subscription_expiry && new Date(user.subscription_expiry) <= new Date()) return 'Inactive';
  if (status === 'active' || status === 'approved') return 'Active';
  return 'Inactive';
}

function StatusBadge({ user, featuredBoost = false }: { user: Proposal; featuredBoost?: boolean }) {
  const label = getStatusLabel(user, featuredBoost);
  const styles: Record<string, { color: string; bg: string }> = {
    Active:   { color: '#16A34A', bg: '#DCFCE7' },
    Featured: { color: '#E8620A', bg: '#FEEDE3' },
    Pending:  { color: '#F59E0B', bg: '#FEF3C7' },
    Paused:   { color: '#0F6E56', bg: '#E1F5EE' },
    Inactive: { color: '#6B7280', bg: '#F3F4F6' },
    Removed:  { color: '#E11D48', bg: '#FFE4E6' },
    Rejected: { color: '#E11D48', bg: '#FFE4E6' },
  };
  const s = styles[label] ?? { color: '#6B7280', bg: '#F3F4F6' };
  return <Badge color={s.color} bg={s.bg}>{label}</Badge>;
}

// ── Phone number detection ──────────────────────────────────────────────────
function containsPhoneNumber(text: string): boolean {
  if (!text || text.length < 5) return false;
  let t = text;
  // Unicode digits → ASCII
  t = t.split('').map(ch => {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    if (code >= 0xFF10 && code <= 0xFF19) return String(code - 0xFF10);
    return ch;
  }).join('');
  // Emoji numbers
  t = t.replace(/0️⃣/g,'0').replace(/1️⃣/g,'1').replace(/2️⃣/g,'2').replace(/3️⃣/g,'3')
       .replace(/4️⃣/g,'4').replace(/5️⃣/g,'5').replace(/6️⃣/g,'6').replace(/7️⃣/g,'7')
       .replace(/8️⃣/g,'8').replace(/9️⃣/g,'9');
  t = t.toLowerCase();
  // Word substitutions
  const words: Record<string,string> = {
    zero:'0',zer0:'0',sifar:'0',oh:'0',one:'1',aik:'1',ek:'1',two:'2',do:'2',
    three:'3',teen:'3',four:'4',char:'4',five:'5',panch:'5',six:'6',chay:'6',
    seven:'7',sat:'7',eight:'8',aath:'8',nine:'9',nau:'9',niner:'9',ate:'8',
  };
  for (const [w,d] of Object.entries(words)) t = t.replace(new RegExp(`\\b${w}\\b`,'g'), d);
  // Letter subs between digits
  t = t.replace(/([0-9])[oO]([0-9])/g,'$10$2').replace(/([0-9])[lIi]([0-9])/g,'$11$2');
  // Dot-removed variant for "z.e.r.o" style
  const t2 = t.replace(/([a-z])\.([a-z])/g,'$1$2');
  const check = (s: string) => {
    if (/03\d([\s\-./_()|,]{0,3}\d){8}/.test(s)) return true;
    if (/(\+92|0092|92)[\s\-./]*3\d[\s\-./]*\d{8}/.test(s)) return true;
    const stripped = s.replace(/[\s\-./_()|,\\:;+*#@!\[\]{}<>~`'"^=]/g,'').replace(/[^0-9]/g,'');
    if (/\d{10,}/.test(stripped)) return true;
    const groups = (s.match(/\d+/g)||[]).join('');
    if (groups.length >= 10 && (/^(03|923|0092)/.test(groups) || groups.length >= 11)) return true;
    if (groups.length >= 10 && /^(03|923)/.test(groups.split('').reverse().join(''))) return true;
    if (/(^|[\s,])(\d[\s\-./|,]{1,4}){7,}\d/.test(s)) return true;
    if (/whatsapp|watsapp|call me|contact me|reach me|ping me|my number|mera number|mob:|cell:|ph:|tel:/.test(s) && /\d{4,}/.test(s)) return true;
    return false;
  };
  return check(t) || check(t2);
}

const PHONE_ERROR = 'Phone numbers are not allowed. Contact details are visible to subscribed members only.';
const PHONE_FIELDS = ['name','location','degree_title','institute','degree_title_2','institute_2','degree_title_3','institute_3','father_occupation','mother_occupation','about','looking_for','caste','profession','disability_details','house_size','car_name'];

// ── Profession groups ───────────────────────────────────────────────────────
const CASTE_GROUPS: Record<string, string[]> = {
  'Other': ['Other'],
  'Punjab': ['Jatt / Jat','Rajput','Arain','Gujjar','Sheikh','Syed','Mughal','Malik','Awan','Bhatti','Khokhar','Dogar','Tiwana','Kamboh','Ansari','Qureshi'],
  'Sindh': ['Sindhi Syed','Soomro','Junejo','Memon','Lohana','Khuhro','Chandio','Brohi','Abbasi','Jatoi','Palijo'],
  'Balochistan': ['Bugti','Marri','Mengal','Rind','Raisani'],
  'KPK / Pashtun': ['Afridi','Yousafzai','Khattak','Shinwari','Bangash','Mohmand','Wazir','Mehsud','Tareen'],
  'Kashmir & Northern': ['Butt','Dar','Lone','Mir','Chaudhry','Raja'],
  'Urdu-speaking / Muhajir': ['Siddiqui','Farooqui','Usmani','Rizvi','Zaidi','Memon'],
};
const CASTE_LIST = Object.values(CASTE_GROUPS).flat();

const PROFESSION_GROUPS: Record<string, string[]> = {
  'Other': ['Other'],
  'Healthcare': ['Doctor','General Physician','Dentist','Dermatologist','Pediatrician','Orthopedic Surgeon','Surgeon','ENT Specialist','Psychiatrist','Psychologist','Radiologist','Pathologist','Nurse','Nutritionist','Physiotherapist','Dental Assistant','Lab Technician','Pharmacist','Ultrasound Technician','Medical Representative','Optician','Microbiologist','Biochemist','Biomedical Engineer','Genetic Engineer'],
  'Engineering': ['Software Engineer','Civil Engineer','Mechanical Engineer','Electrical Engineer','Electronics Engineer','Chemical Engineer','Aeronautical Engineer','Agricultural Engineer','Automobile Engineer','Computer Engineer','Telecom Engineer','Textile Engineer','Industrial Engineer','Flight Engineer','Robotics Engineer','Hardware Engineer','Network Engineer','Cloud Engineer','Food Technologist','Quantity Surveyor'],
  'IT & Tech': ['Developer','Frontend Developer','Java Developer','Web Developer','Web Designer','UI Designer','UI/UX Designer','Graphic Designer','Programmer','Data Analyst','Data Scientist','Cyber Security Expert','Information Security Analyst','IT Administrator','IT Support Specialist','Network Administrator','SEO Expert','Digital Marketer','Social Media Manager','Blogger','Content Creator','Copywriter','Freelancer','YouTuber','QA Engineer','Drone Operator'],
  'Education': ['Teacher','School Teacher','Lecturer','Professor','University Professor','Principal','Headmaster','Home Tutor','Coach','Trainer','Qari','Research Scientist','Research Assistant'],
  'Finance & Law': ['Accountant','Chartered Accountant','Financial Advisor','Investment Banker','Tax Consultant','Insurance Agent','Economist','Business Analyst','Lawyer','Advocate','Judge','CSS Officer'],
  'Business & Management': ['Business Owner','General Manager','Operation Manager','Product Manager','Project Manager','HR Manager','Human Resource Officer','Marketing Manager','Sales Executive','Bank Manager','Hotel Manager','Construction Manager','Logistic Manager','Warehouse Manager','Import Export Agent','Property Dealer','Real Estate Agent','Trader','Consultant'],
  'Government & Forces': ['Army Officer','Police Officer','Traffic Police Officer','Government Officer','Administrative Officer','Agriculture Officer','Field Officer','Railway Officer','Naib Qasid','Security Guard','Firefighter'],
  'Media & Creative': ['Photographer','Videographer','Video Editor','Cameraman','Actor','Fashion Model','Model','Television Host','Journalist','Editor','Multimedia Specialist','Animator','Sound Engineer','Music Teacher','Influencer'],
  'Trades & Skilled': ['Electrician','Plumber','Carpenter','Mason','Brick Mason','Welder','Painter','Auto Electrician','Mobile Repair Technician','Solar Technician','Technician','Machine Operator','Tailor','Embroidery Worker','Baker','Chef','Barber','Beautician'],
  'Services & Other': ['Driver','Truck Driver','Rider','Delivery Rider','Courier Rider','Food Panda Rider','Waiter','Receptionist','Cashier','Shopkeeper','JazzCash Agent','Call Center Agent','Dispatcher','Tour Guide','Social Worker','Veterinarian','Farmer','Livestock Farmer','Fisherman','Florist','Decorator','Interior Designer','Event Manager','Sports Coach','Athlete','Stenographer','Librarian','Interpreter','Translator','Virtual Assistant','Janitor','Kitchen Helper','Kitchen Supervisor','Safety Officer','Surveyor','Public Relations Officer','Zoologist','Scientist','Freelance Writer','Writer','Fashion Designer','Textile Designer','Makeup Artist','Businessman','Housewife','Gardener','Butcher','Cobbler'],
};
const PROFESSION_LIST = ['Other', ...Object.values(PROFESSION_GROUPS).flat()];

// ── Searchable dropdown ─────────────────────────────────────────────────────
function SearchableSelect({ value, options, onChange, placeholder = '— Select —', grouped }: {
  value: string; options: string[]; onChange: (v: string) => void; placeholder?: string; grouped?: Record<string, string[]>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const renderItems = () => {
    if (grouped && !search) {
      return Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 800, color: '#B0ADCB', textTransform: 'uppercase', letterSpacing: 0.8 }}>{group}</div>
          {items.map(o => (
            <div key={o} onClick={() => { onChange(o); setOpen(false); setSearch(''); }}
              style={{ padding: '8px 14px 8px 20px', fontSize: 13, cursor: 'pointer', color: o === value ? '#534AB7' : '#1A1830', fontWeight: o === value ? 700 : 400, background: o === value ? '#EEEDFE' : 'transparent' }}
              onMouseEnter={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
              onMouseLeave={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              {o}
            </div>
          ))}
        </div>
      ));
    }
    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    if (filtered.length === 0) return <div style={{ padding: '10px 14px', fontSize: 13, color: '#B0ADCB' }}>No results</div>;
    return filtered.map(o => (
      <div key={o} onClick={() => { onChange(o); setOpen(false); setSearch(''); }}
        style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: o === value ? '#534AB7' : '#1A1830', fontWeight: o === value ? 700 : 400, background: o === value ? '#EEEDFE' : 'transparent' }}
        onMouseEnter={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
        onMouseLeave={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
        {o}
      </div>
    ));
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E8E6F5', fontSize: 14, background: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' as const }}>
        <span style={{ color: value ? '#1A1830' : '#B0ADCB' }}>{value || placeholder}</span>
        <span style={{ color: '#B0ADCB', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E8E6F5', borderRadius: 10, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxHeight: 280, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #E8E6F5' }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #E8E6F5', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div style={{ overflowY: 'auto' as const, flex: 1 }}>{renderItems()}</div>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MyProposalClient() {
  const router = useRouter();
  const [user, setUser] = useState<Proposal | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [savedProposals, setSavedProposals] = useState<Proposal[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [featuredBannerDismissed, setFeaturedBannerDismissed] = useState(false);
  const [hasFeaturedBoost, setHasFeaturedBoost] = useState(false);
  // Delete modal
  const [deleteStep, setDeleteStep] = useState<'reason' | 'password' | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deleteReasons = [
    'I have found a proposal through Jor.',
    'I have found a proposal from an external source.',
    'I have decided to take a break and may return later.',
    'I did not find this application useful.',
  ];
  const [saveMsg, setSaveMsg] = useState('');
  // Inline editing
  const [inlineKey, setInlineKey] = useState<string | null>(null);
  const [inlineVal, setInlineVal] = useState<string>('');
  const [inlineCustomVal, setInlineCustomVal] = useState<string>('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const inlineOtherFields = ['caste', 'profession', 'father_occupation', 'mother_occupation'];
  // House size
  const [hsNum, setHsNum] = useState('');
  const [hsUnit, setHsUnit] = useState('Marla');
  // Photo crop
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), []);
  // Unused but kept for compatibility
  const [editing] = useState(false);
  const [editAbout, setEditAbout] = useState('');
  const [editLooking, setEditLooking] = useState('');
  const [showDeg2, setShowDeg2] = useState(false);
  const [showDeg3, setShowDeg3] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.replace('/login'); return; }
    setUser(session);
    setSavedIds(getSavedIds());
    // Always fetch fresh data so status/subscription changes are reflected
    supabase.from('proposals').select('*').eq('id', session.id).maybeSingle().then(({ data }) => {
      if (data) {
        const fresh = data as Proposal;
        setUser(fresh);
        if (fresh.degree_title_2 || fresh.institute_2) setShowDeg2(true);
        if (fresh.degree_title_3 || fresh.institute_3) setShowDeg3(true);
        import('@/lib/auth').then(m => m.saveSession(fresh));
      }
    });
    // Check for active featured boost today
    const now = new Date();
    supabase.from('featured_boosts')
      .select('scheduled_date, is_used')
      .eq('user_id', session.id)
      .eq('is_used', false)
      .then(({ data: boosts }) => {
        if (boosts) {
          const active = boosts.some((b: { scheduled_date: string; is_used: boolean }) => {
            const start = new Date(b.scheduled_date);
            const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
            return now >= start && now < end;
          });
          setHasFeaturedBoost(active);
        }
      });
  }, [router]);

  useEffect(() => {
    if (tab === 'saved' && user) {
      const ids = getSavedIds();
      if (ids.length === 0) { setSavedProposals([]); return; }
      setLoadingSaved(true);
      Promise.all(ids.map((id: string) => fetchProposalById(id)))
        .then(results => setSavedProposals(results.filter(Boolean) as Proposal[]))
        .finally(() => setLoadingSaved(false));
    }
  }, [tab, user]);

  const handleLogout = () => { clearSession(); router.push('/'); };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result as string); setZoom(1); setCrop({ x: 0, y: 0 }); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels || !user) return;
    setUploadingPhoto(true);
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels);
      const path = `${user.id}.jpg`;
      const { error } = await supabase.storage.from('profile-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path);
      const photoUrl = `${publicUrl}?t=${Date.now()}`;
      await updateProposal(user.id, { profile_photo_url: photoUrl });
      const updated = { ...user, profile_photo_url: photoUrl };
      setUser(updated as typeof user);
      import('@/lib/auth').then(m => m.saveSession(updated as typeof user));
      setCropSrc(null);
      setSaveMsg('Photo updated successfully.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch {
      setSaveMsg('Failed to upload photo. Please try again.');
      setTimeout(() => setSaveMsg(''), 3000);
    }
    setUploadingPhoto(false);
  };

  const handleToggleSaved = (id: string) => {
    const newIds = toggleSavedFn(id);
    setSavedIds(newIds);
    if (!newIds.includes(id)) setSavedProposals(prev => prev.filter(p => p.id !== id));
  };

  const saveInline = async (key: string, val: unknown) => {
    if (!user) return;
    const finalVal = inlineOtherFields.includes(key) && val === 'Other' && inlineCustomVal.trim()
      ? inlineCustomVal.trim() : val;
    const updates: Record<string, unknown> = { [key]: key === 'languages' ? (finalVal ? [finalVal] : []) : finalVal };
    const oldValues: Record<string, unknown> = {};
    if (key in user) oldValues[key] = (user as Record<string, unknown>)[key];

    setInlineSaving(true);
    try {
      // Apply immediately to proposals table
      const ok = await updateProposal(user.id, updates);
      if (ok) {
        const updated = { ...user, ...updates };
        setUser(updated as typeof user);
        import('@/lib/auth').then(m => m.saveSession(updated as typeof user));
        // Log to profile_edit_requests for admin visibility (status: applied)
        await supabase.from('profile_edit_requests').insert({
          proposal_id: user.id,
          changes: updates,
          old_values: oldValues,
          status: 'applied',
        });
        setInlineKey(null);
        setInlineCustomVal('');
        setSaveMsg('Changes saved successfully.');
        setTimeout(() => setSaveMsg(''), 3000);
      }
    } catch {
      setSaveMsg('Failed to save. Please try again.');
      setTimeout(() => setSaveMsg(''), 3000);
    }
    setInlineSaving(false);
  };

  if (!user) return <div style={{ textAlign: 'center', padding: 60, color: '#B0ADCB' }}>Loading...</div>;

  const isActive = isSubscriptionActive(user);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1830' }}>My Account</h1>
      </div>

      {/* Profile card */}
      <div style={{ background: user.is_boosted ? '#FFFBF5' : '#fff', border: `1px solid ${user.is_boosted ? '#E8620A44' : '#E8E6F5'}`, borderRadius: 20, padding: '20px', marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="my-account-left" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div onClick={() => photoInputRef.current?.click()} style={{ position: 'relative', width: 72, height: 72, borderRadius: 36, flexShrink: 0, cursor: 'pointer' }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, background: user.gender === 'Male' ? '#534AB7' : '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff', fontWeight: 900, overflow: 'hidden' }}>
              {user.profile_photo_url ? <img src={user.profile_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.name.charAt(0)}
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, background: '#534AB7', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
          <div style={{ flex: 1 }}>
            {/* Name + ACTIVE badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap', width: '100%' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1A1830' }}>{user.name}</div>
              <StatusBadge user={user} featuredBoost={hasFeaturedBoost} />
              {user.proposal_number && <div className="hash-mobile" style={{ display: 'none', fontSize: 13, color: '#6B6893', marginLeft: 'auto', marginRight: 0 }}>#{user.proposal_number}</div>}
            </div>
            <div style={{ fontSize: 13, color: '#6B6893', marginBottom: 2 }}>
              {user.age} yrs{user.profession ? ` • ${user.profession}` : ''}
            </div>
            <div style={{ fontSize: 13, color: '#6B6893', marginBottom: 8 }}>
              {user.country && user.country !== 'Pakistan' ? `${user.country} (from ${user.city})` : user.city}
            </div>
            {/* Subscription + verification badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>

            </div>
          </div>
        </div>
        <div className="my-account-right" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {user.proposal_number && <div className="hash-desktop" style={{ fontSize: 13, color: '#6B6893', lineHeight: '28px' }}>#{user.proposal_number}</div>}
          <div className="my-account-actions" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}>
            {/* View */}
            {(['Active','Featured'].includes(getStatusLabel(user, hasFeaturedBoost))) && <Link href={`/proposal/${user.id}`}
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E8E6F5', background: '#EEEDFE', textDecoration: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#534AB7' }}>View</span>
            </Link>}
            {/* Share */}
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/proposal/${user.id}`); setSaveMsg('Profile link copied!'); setTimeout(() => setSaveMsg(''), 3000); }}
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E8E6F5', background: '#fff', cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#534AB7' }}>Share</span>
            </button>
            {/* Pause/Resume — only for active/paused users */}
            {(['Active', 'Featured', 'Paused'].includes(getStatusLabel(user, hasFeaturedBoost))) && <button onClick={async () => {
                const isPaused = user.status === 'paused';
                const msg = isPaused ? 'Resume your profile? It will become visible in the group again.' : 'Pause your profile? It will be hidden from the group. You can resume anytime.';
                if (!window.confirm(msg)) return;
                const ok = await updateProposal(user.id, { status: isPaused ? 'active' : 'paused' });
                if (ok) { const updated = { ...user, status: isPaused ? 'active' : 'paused' }; setUser(updated as typeof user); import('@/lib/auth').then(m => m.saveSession(updated as typeof user)); }
              }}
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E8E6F5', background: '#fff', cursor: 'pointer' }}>
              {user.status === 'paused'
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              }
              <span style={{ fontSize: 10, fontWeight: 700, color: user.status === 'paused' ? '#16A34A' : '#6B7280' }}>{user.status === 'paused' ? 'Resume' : 'Pause'}</span>
            </button>}
            {/* Delete */}
            <button onClick={() => { setDeleteReason(''); setDeletePassword(''); setDeleteError(''); setDeleteStep('reason'); }}
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626' }}>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status banners */}
      {(() => {
        const label = getStatusLabel(user);
        if (label === 'Pending') return (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#92400E', marginBottom: 2 }}>Profile Under Review</div>
              <div style={{ fontSize: 13, color: '#B45309', lineHeight: 1.5 }}>Your profile is being reviewed by our team. It may take up to 24 hours. You&apos;ll be notified once it&apos;s approved and live.</div>
            </div>
          </div>
        );
        if (label === 'Paused') return (
          <div style={{ background: '#F9FAFB', border: '1px solid #D1D5DB', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#374151', marginBottom: 2 }}>Profile Paused</div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>Your profile is hidden from the listing. Click &ldquo;Resume&rdquo; to make it visible again.</div>
            </div>
          </div>
        );
        if (label === 'Inactive') return (
          <div style={{ background: '#F9FAFB', border: '1px solid #D1D5DB', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#374151', marginBottom: 2 }}>Subscription Expired</div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>Your subscription has expired. Please renew to keep your profile visible.</div>
            </div>
          </div>
        );
        if (label === 'Featured') return (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#92400E', marginBottom: 2 }}>Featured Profile</div>
              <div style={{ fontSize: 13, color: '#B45309', lineHeight: 1.5 }}>Your profile is featured and appears at the top of search results.</div>
            </div>
          </div>
        );
        if (label === 'Rejected' || label === 'Removed') return (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#991B1B', marginBottom: 2 }}>Profile {label}</div>
              <div style={{ fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>Your profile has been {label.toLowerCase()} by the admin. Please contact support for assistance.</div>
            </div>
          </div>
        );
        return null;
      })()}

      {/* Featured upsell — active non-featured users only, dismissable per session */}
      {getStatusLabel(user, hasFeaturedBoost) === 'Active' && !featuredBannerDismissed && (
        <div style={{ background: 'linear-gradient(135deg, #7C5CFA 0%, #534AB7 100%)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', bottom: -30, left: 60, width: 140, height: 140, borderRadius: 70, background: 'rgba(255,255,255,0.04)' }} />
          <button onClick={() => setFeaturedBannerDismissed(true)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>✕</button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Upgrade to Featured — Stand Out from the Rest</div>
              <div style={{ fontSize: 13, color: '#D4D1F7', lineHeight: 1.5, marginBottom: 12 }}>Featured profiles appear at the top of every search, get a gold badge, and receive 5× more views than regular profiles.</div>
              <Link href="/subscription?plan=featured" style={{ display: 'inline-block', padding: '9px 20px', borderRadius: 10, background: '#fff', color: '#534AB7', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>Get Featured →</Link>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F5F5F5', borderRadius: 12, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {(['profile', 'saved'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: tab === t ? '#534AB7' : 'transparent', color: tab === t ? '#fff' : '#6B6893' }}>
            {t === 'profile' ? 'My Profile' : `Saved (${savedIds.length})`}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div>
          {saveMsg && <div style={{ background: saveMsg.includes('not allowed') || saveMsg.includes('Failed') ? '#FEE2E2' : '#DCFCE7', border: `1px solid ${saveMsg.includes('not allowed') || saveMsg.includes('Failed') ? '#DC262644' : '#16A34A44'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: saveMsg.includes('not allowed') || saveMsg.includes('Failed') ? '#DC2626' : '#16A34A', marginBottom: 16 }}>{saveMsg}</div>}

          {(() => {
            const fieldStyle = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #534AB7', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const };
            const inlineButtons = (key: string, val: unknown) => (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => saveInline(key, val)} disabled={inlineSaving}
                  style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {inlineSaving ? '...' : 'Save'}
                </button>
                <button onClick={() => setInlineKey(null)}
                  style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            );
            const emptyPill = (key: string) => (
              <span onClick={() => { setInlineKey(key); setInlineVal(''); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#534AB7', background: '#EEEDFE', border: '1px dashed #C4C2D8', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', marginTop: 2 }}>
                + Add
              </span>
            );
            const lbl = (label: string) => (
              <label style={{ fontSize: 11, fontWeight: 700, color: '#B0ADCB', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</label>
            );
            const pencil = (
              <svg className="edit-icon" style={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            );

            const Field = ({ label, fieldKey, type = 'text', options, grouped }: { label: string; fieldKey: string; type?: string; options?: string[]; grouped?: Record<string, string[]> }) => {
              const val = user[fieldKey as keyof typeof user];
              const isEditing = inlineKey === fieldKey;
              const displayVal = val != null && val !== '' && !(type === 'number' && Number(val) === 0) ? String(val) : null;
              return (
                <div style={{ marginBottom: 14 }}>
                  {lbl(label)}
                  {isEditing ? (
                    <>
                      {options
                        ? options.length > 15
                          ? <><SearchableSelect value={inlineVal} options={options} onChange={v => { setInlineVal(v); if (v !== 'Other') setInlineCustomVal(''); }} grouped={grouped} />
                              {inlineVal === 'Other' && inlineOtherFields.includes(fieldKey) && (
                                <input value={inlineCustomVal} onChange={e => setInlineCustomVal(e.target.value)} placeholder="Please specify..." style={{ ...fieldStyle, marginTop: 8 }} autoFocus maxLength={inlineOtherFields.includes(inlineKey ?? '') ? 30 : undefined} />
                              )}</>
                          : <select value={inlineVal} onChange={e => setInlineVal(e.target.value)} style={{ ...fieldStyle, background: '#fff' }}>
                              <option value="">— Select —</option>
                              {options.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        : <input type={type} value={inlineVal} onChange={e => setInlineVal(e.target.value)} style={fieldStyle} autoFocus />
                      }
                      {inlineButtons(fieldKey, type === 'number' ? Number(inlineVal) : inlineVal)}
                    </>
                  ) : displayVal ? (
                    <div onClick={() => { setInlineKey(fieldKey); setInlineVal(displayVal); }}
                      style={{ fontSize: 14, color: '#1A1830', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseEnter={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '1'; }}
                      onMouseLeave={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '0'; }}>
                      <span>{displayVal}</span>{pencil}
                    </div>
                  ) : emptyPill(fieldKey)}
                </div>
              );
            };

            const BoolField = ({ label, fieldKey }: { label: string; fieldKey: string }) => {
              const val = user[fieldKey as keyof typeof user];
              const isEditing = inlineKey === fieldKey;
              const displayVal = val != null ? (val ? 'Yes' : 'No') : null;
              return (
                <div style={{ marginBottom: 14 }}>
                  {lbl(label)}
                  {isEditing ? (
                    <>
                      <select value={inlineVal} onChange={e => setInlineVal(e.target.value)} style={{ ...fieldStyle, background: '#fff' }}>
                        <option value="">— Select —</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      {inlineButtons(fieldKey, inlineVal === 'true' ? true : inlineVal === 'false' ? false : null)}
                    </>
                  ) : displayVal ? (
                    <div onClick={() => { setInlineKey(fieldKey); setInlineVal(String(val)); }}
                      style={{ fontSize: 14, color: '#1A1830', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseEnter={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '1'; }}
                      onMouseLeave={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '0'; }}>
                      <span>{displayVal}</span>{pencil}
                    </div>
                  ) : emptyPill(fieldKey)}
                </div>
              );
            };

            const HeightField = () => {
              const htFt = user.height_inches ? `${Math.floor(user.height_inches / 12)}'${Math.round(user.height_inches % 12)}"` : null;
              const isEditing = inlineKey === 'height_inches';
              const inFt = inlineVal ? Math.floor(Number(inlineVal) / 12) : 0;
              const inIn = inlineVal ? Math.round(Number(inlineVal) % 12) : 0;
              return (
                <div style={{ marginBottom: 14 }}>
                  {lbl('Height')}
                  {isEditing ? (
                    <>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select value={inFt || ''} onChange={e => setInlineVal(String(Number(e.target.value) * 12 + inIn))} style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: '1.5px solid #534AB7', fontSize: 14, outline: 'none', background: '#fff' }}>
                          <option value="">ft</option>
                          {[4,5,6,7].map(f => <option key={f} value={f}>{f} ft</option>)}
                        </select>
                        <select value={inIn} onChange={e => setInlineVal(String(inFt * 12 + Number(e.target.value)))} style={{ flex: 1, padding: '9px 8px', borderRadius: 10, border: '1.5px solid #534AB7', fontSize: 14, outline: 'none', background: '#fff' }}>
                          {Array.from({length:12},(_,i)=>i).map(i => <option key={i} value={i}>{i} in</option>)}
                        </select>
                      </div>
                      {inlineButtons('height_inches', Number(inlineVal) || 0)}
                    </>
                  ) : htFt ? (
                    <div onClick={() => { setInlineKey('height_inches'); setInlineVal(String(user.height_inches)); }}
                      style={{ fontSize: 14, color: '#1A1830', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseEnter={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '1'; }}
                      onMouseLeave={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '0'; }}>
                      <span>{htFt}</span>{pencil}
                    </div>
                  ) : emptyPill('height_inches')}
                </div>
              );
            };

            const LangField = () => {
              const val = user.languages?.[0] ?? null;
              const isEditing = inlineKey === 'languages';
              return (
                <div style={{ marginBottom: 14 }}>
                  {lbl('Native Language')}
                  {isEditing ? (
                    <>
                      <select value={inlineVal} onChange={e => setInlineVal(e.target.value)} style={{ ...fieldStyle, background: '#fff' }}>
                        <option value="">— Select —</option>
                        {['Urdu','Punjabi','Pashto','Sindhi','Saraiki','Balochi','English'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {inlineButtons('languages', inlineVal)}
                    </>
                  ) : val ? (
                    <div onClick={() => { setInlineKey('languages'); setInlineVal(val); }}
                      style={{ fontSize: 14, color: '#1A1830', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseEnter={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '1'; }}
                      onMouseLeave={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '0'; }}>
                      <span>{val}</span>{pencil}
                    </div>
                  ) : emptyPill('languages')}
                </div>
              );
            };

            const AboutField = ({ fieldKey, label }: { fieldKey: 'about' | 'looking_for'; label: string }) => {
              const val = user[fieldKey];
              const isEditing = inlineKey === fieldKey;
              return (
                <div style={{ marginBottom: 16 }}>
                  {lbl(label)}
                  {isEditing ? (
                    <>
                      <textarea value={inlineVal} onChange={e => setInlineVal(e.target.value.slice(0,200))} rows={3} maxLength={200}
                        style={{ ...fieldStyle, resize: 'vertical' as const }}
                        ref={el => { if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }} />
                      <div style={{ fontSize: 11, color: '#B0ADCB', marginBottom: 4, textAlign: 'right' as const }}>{inlineVal.length}/200</div>
                      {inlineButtons(fieldKey, inlineVal)}
                    </>
                  ) : val ? (
                    <div onClick={() => { setInlineKey(fieldKey); setInlineVal(val); }}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '1'; }}
                      onMouseLeave={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '0'; }}>
                      <p style={{ fontSize: 14, color: '#1A1830', lineHeight: 1.6, margin: 0 }}>{val}</p>
                      {pencil}
                    </div>
                  ) : emptyPill(fieldKey)}
                </div>
              );
            };

            const maritalOpts = user.gender === 'Male'
              ? ['Never Married','Married','Divorced','Widowed']
              : ['Never Married','Divorced','Khula','Widowed'];

            const sec = (title: string, children: React.ReactNode) => (
              <div style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#534AB7', marginBottom: 14 }}>{title}</h3>
                {children}
              </div>
            );

            const grid = (children: React.ReactNode) => (
              <div className="form-grid-2col" style={{ gap: '0 24px', alignItems: 'start' }}>{children}</div>
            );

            return (
              <>
                {sec('Basic Information', grid(<>
                  <Field label="Full Name" fieldKey="name" />
                  <Field label="Age" fieldKey="age" type="number" />
                  <Field label="City" fieldKey="city" options={['Lahore','Karachi','Islamabad','Rawalpindi','Faisalabad','Multan','Gujranwala','Sialkot','Bahawalpur','Sargodha','Peshawar','Quetta','Hyderabad','Abbottabad','Other']} />
                  <Field label="Country (Overseas)" fieldKey="country" options={['Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Belgium','Bosnia & Herzegovina','Brunei','Bulgaria','Cambodia','Canada','China','Colombia','Croatia','Cyprus','Czech Republic','Denmark','Egypt','Estonia','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Latvia','Lebanon','Libya','Lithuania','Luxembourg','Malaysia','Maldives','Malta','Mexico','Moldova','Monaco','Mongolia','Morocco','Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Philippines','Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia','Singapore','Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Taiwan','Tanzania','Thailand','Turkey','UAE','Uganda','Ukraine','United Kingdom','United States','Uruguay','Uzbekistan','Vietnam','Yemen','Zambia','Zimbabwe']} />
                  <Field label="Location (Area)" fieldKey="location" />
                  <Field label="Weight (kg)" fieldKey="weight_kg" type="number" />
                  <HeightField />
                  <Field label="Complexion" fieldKey="complexion" options={['Fair','Wheatish','Brown','Dark']} />
                  <Field label="Marital Status" fieldKey="marital_status" options={maritalOpts} />
                  {['Married','Divorced','Khula','Widowed'].includes(user.marital_status || '') && <>
                    {!(user.has_kids === true || user.has_kids as unknown === 'true') && <BoolField label="Has Kids" fieldKey="has_kids" />}
                    {(user.has_kids === true || user.has_kids as unknown === 'true') && <>
                      <Field label="Sons" fieldKey="boys" type="number" />
                      <Field label="Daughters" fieldKey="girls" type="number" />
                    </>}
                    {user.marital_status === 'Married' && <Field label="Looking For" fieldKey="marriage_number" options={['Second marriage','Third marriage','Fourth marriage']} />}
                  </>}
                  <Field label="Caste" fieldKey="caste" options={CASTE_LIST} grouped={CASTE_GROUPS} />
                  <Field label="Sect" fieldKey="sect" options={['Sunni','Shia','Barelvi','Deobandi','Ahl-e-Hadith','Other']} />
                  <Field label="Practice Level" fieldKey="practice_level" options={['High','Moderate','Low']} />
                  {user.gender === 'Female' ? <Field label="Hijab" fieldKey="hijab" options={['Yes','No','Sometimes']} /> : <Field label="Beard" fieldKey="beard" options={['Yes','No','Trimmed']} />}
                  <LangField />
                  <AboutField fieldKey="about" label="About" />
                  <AboutField fieldKey="looking_for" label="Looking For" />
                </>))}

                {sec('Family', grid(<>
                  <BoolField label="Father Alive" fieldKey="father_alive" />
                  <BoolField label="Mother Alive" fieldKey="mother_alive" />
                  <Field label="Father Occupation" fieldKey="father_occupation" options={PROFESSION_LIST} grouped={PROFESSION_GROUPS} />
                  <Field label="Mother Occupation" fieldKey="mother_occupation" options={PROFESSION_LIST} grouped={PROFESSION_GROUPS} />
                  <BoolField label="Has Siblings" fieldKey="has_siblings" />
                  {(user.has_siblings === true || user.has_siblings as unknown === 'true') && <>
                    <Field label="Brothers" fieldKey="brothers" type="number" />
                    <Field label="Sisters" fieldKey="sisters" type="number" />
                  </>}
                </>))}

                {sec('Education & Career', grid(<>
                  <Field label="Education Level (Highest)" fieldKey="education" options={["Matric","FSc/FA","Diploma","Bachelor's","Master's","MPhil","PhD","Other"]} />
                  <div style={{ gridColumn: '1 / -1', fontSize: 13, fontWeight: 700, color: '#534AB7', marginBottom: 2 }}>Degree</div>
                  <Field label="Title" fieldKey="degree_title" />
                  <Field label="Institute" fieldKey="institute" />
                  {!showDeg2 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <button onClick={() => setShowDeg2(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#534AB7', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                        <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Add another degree
                      </button>
                    </div>
                  )}
                  {showDeg2 && <>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#534AB7' }}>Degree 2</span>
                      <button onClick={() => { setShowDeg2(false); setShowDeg3(false); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12 }}>✕ Remove</button>
                    </div>
                    <Field label="Title" fieldKey="degree_title_2" />
                    <Field label="Institute 2" fieldKey="institute_2" />
                    {!showDeg3 && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <button onClick={() => setShowDeg3(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#534AB7', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Add another degree
                        </button>
                      </div>
                    )}
                  </>}
                  {showDeg2 && showDeg3 && <>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#534AB7' }}>Degree 3</span>
                      <button onClick={() => setShowDeg3(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12 }}>✕ Remove</button>
                    </div>
                    <Field label="Title" fieldKey="degree_title_3" />
                    <Field label="Institute 3" fieldKey="institute_3" />
                  </>}
                  <Field label="Occupation" fieldKey="profession" options={PROFESSION_LIST} grouped={PROFESSION_GROUPS} />
                  <Field label="Employment Type" fieldKey="employment_type" options={['Full-time','Part-time','Self-employed','Business','Freelance','Not employed']} />
                  <Field label="Monthly Income" fieldKey="monthly_income" options={['Below 30k','30k-60k','60k-100k','100k-150k','150k-200k','200k-300k','Above 300k']} />
                </>))}

                {sec('Health & Lifestyle', grid(<>
                  <Field label="Lifestyle" fieldKey="physically_active" options={['Active Living','Sedentary Living','Balance']} />
                  <BoolField label="Smoker" fieldKey="smokes" />
                  <BoolField label="Disability / Chronic Illness" fieldKey="has_disability" />
                  {user.has_disability && (() => {
                    const isEditing = inlineKey === 'disability_details';
                    const val = user.disability_details;
                    return (
                      <div style={{ marginBottom: 14, gridColumn: '1 / -1' }}>
                        {lbl('Disability Details')}
                        {isEditing ? (
                          <>
                            <textarea value={inlineVal} onChange={e => setInlineVal(e.target.value.slice(0,200))} rows={3} maxLength={200}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #534AB7', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const }}
                              ref={el => { if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }} />
                            <div style={{ fontSize: 11, color: '#B0ADCB', textAlign: 'right' as const, marginBottom: 4 }}>{inlineVal.length}/200</div>
                            {inlineButtons('disability_details', inlineVal)}
                          </>
                        ) : val ? (
                          <div onClick={() => { setInlineKey('disability_details'); setInlineVal(val); }}
                            style={{ fontSize: 14, color: '#1A1830', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            onMouseEnter={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '1'; }}
                            onMouseLeave={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '0'; }}>
                            <span>{val}</span>{pencil}
                          </div>
                        ) : emptyPill('disability_details')}
                      </div>
                    );
                  })()}
                </>))}

                {sec('Property & Assets', grid(<>
                  <Field label="Home Type" fieldKey="home_type" options={['Own House','Rented House']} />
                  {/* House Size with Marla/Kanal */}
                  {(() => {
                    const isEditing = inlineKey === 'house_size';
                    const val = user.house_size;
                    return (
                      <div style={{ marginBottom: 14 }}>
                        {lbl('House Size')}
                        {isEditing ? (
                          <>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input type="number" value={hsNum} onChange={e => setHsNum(e.target.value)} placeholder="e.g. 5" style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #534AB7', fontSize: 14, outline: 'none' }} autoFocus />
                              <select value={hsUnit} onChange={e => setHsUnit(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', background: '#fff' }}>
                                <option value="Marla">Marla</option>
                                <option value="Kanal">Kanal</option>
                              </select>
                            </div>
                            {inlineButtons('house_size', hsNum ? `${hsNum} ${hsUnit}` : '')}
                          </>
                        ) : val ? (
                          <div onClick={() => { const parts = val.split(' '); setHsNum(parts[0]||''); setHsUnit(parts[1]||'Marla'); setInlineKey('house_size'); }}
                            style={{ fontSize: 14, color: '#1A1830', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            onMouseEnter={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '1'; }}
                            onMouseLeave={e => { const i = e.currentTarget.querySelector('.edit-icon') as HTMLElement; if (i) i.style.opacity = '0'; }}>
                            <span>{val}</span>{pencil}
                          </div>
                        ) : emptyPill('house_size')}
                      </div>
                    );
                  })()}
                  <Field label="Has Car" fieldKey="has_car" options={['yes','no','Multiple']} />
                  {(user.has_car === 'yes' || user.has_car === 'Multiple') && <Field label="Car Name/Model" fieldKey="car_name" />}
                  <Field label="Other Property" fieldKey="has_other_property" options={['Yes','No']} />
                  {user.has_other_property === 'Yes' && <Field label="Property Type" fieldKey="other_property" options={['Residential','Commercial','Land','Multiple']} />}
                </>))}

                {sec('Contact', grid(<>
                  <Field label="Primary Phone" fieldKey="contact_phone" type="tel" />
                  <Field label="Secondary Phone" fieldKey="contact_phone_2" type="tel" />
                </>))}
              </>
            );
          })()}
        </div>
      )}

      {/* Saved tab */}
      {tab === 'saved' && (
        <div>
          {loadingSaved ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#B0ADCB' }}>Loading...</div>
          ) : savedProposals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#6B6893', marginBottom: 8 }}>No saved proposals yet</div>
              <Link href="/proposals" style={{ color: '#534AB7', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Browse Proposals →</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {savedProposals.map(p => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <ProposalCard proposal={p} />
                  <button onClick={() => handleToggleSaved(p.id)} style={{ position: 'absolute', top: 12, right: 12, background: '#FEE2E2', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#DC2626' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete profile modal */}
      {deleteStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, padding: 24 }}>
            {deleteStep === 'reason' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1830', marginBottom: 4 }}>Delete Profile</div>
                <div style={{ fontSize: 13, color: '#6B6893', marginBottom: 16 }}>Please tell us why you want to delete your profile:</div>
                {deleteReasons.map(r => (
                  <div key={r} onClick={() => setDeleteReason(r)}
                    style={{ padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${deleteReason === r ? '#534AB7' : '#E8E6F5'}`, background: deleteReason === r ? '#EEEDFE' : '#fff', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 8, border: `2px solid ${deleteReason === r ? '#534AB7' : '#C4C2D8'}`, background: deleteReason === r ? '#534AB7' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {deleteReason === r && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: 13, color: deleteReason === r ? '#534AB7' : '#1A1830', fontWeight: deleteReason === r ? 600 : 400 }}>{r}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={() => setDeleteStep(null)} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => { setDeletePassword(''); setDeleteError(''); setDeleteStep('password'); }} disabled={!deleteReason}
                    style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: deleteReason ? '#DC2626' : '#F5F5F5', color: deleteReason ? '#fff' : '#B0ADCB', fontWeight: 800, fontSize: 14, cursor: deleteReason ? 'pointer' : 'not-allowed' }}>
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#DC2626', marginBottom: 4 }}>Confirm Deletion</div>
                <div style={{ fontSize: 13, color: '#6B6893', marginBottom: 4 }}>This cannot be undone. Enter your password to permanently delete your profile.</div>
                <div style={{ fontSize: 12, background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 8, padding: '8px 12px', color: '#DC2626', marginBottom: 16 }}>
                  Reason: {deleteReason}
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={deletePassword}
                  onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                  autoFocus
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${deleteError ? '#DC2626' : '#E8E6F5'}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
                />
                {deleteError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{deleteError}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button onClick={() => setDeleteStep('reason')} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Back</button>
                  <button disabled={!deletePassword || deleting} onClick={async () => {
                    if (!user) return;
                    if (deletePassword.trim() !== user.password) { setDeleteError('Incorrect password. Please try again.'); return; }
                    setDeleting(true);
                    const ok = await updateProposal(user.id, { status: 'deleted', delete_reason: deleteReason });
                    setDeleting(false);
                    if (ok) { clearSession(); router.push('/'); }
                    else { setDeleteError('Failed to delete. Please try again.'); }
                  }}
                    style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: deletePassword && !deleting ? '#DC2626' : '#F5F5F5', color: deletePassword && !deleting ? '#fff' : '#B0ADCB', fontWeight: 800, fontSize: 14, cursor: deletePassword && !deleting ? 'pointer' : 'not-allowed' }}>
                    {deleting ? 'Deleting…' : 'Delete My Profile'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Photo crop modal */}
      {cropSrc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1A1830', borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 420 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #ffffff22' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Crop Photo</div>
              <div style={{ fontSize: 12, color: '#B0ADCB', marginTop: 2 }}>Drag to reposition • Pinch or scroll to zoom</div>
            </div>
            <div style={{ position: 'relative', width: '100%', height: 320, background: '#000' }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0ADCB" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#534AB7' }} />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B0ADCB" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setCropSrc(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid #ffffff33', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCropConfirm} disabled={uploadingPhoto}
                  style={{ flex: 2, padding: '10px', borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: uploadingPhoto ? 'not-allowed' : 'pointer', opacity: uploadingPhoto ? 0.7 : 1 }}>
                  {uploadingPhoto ? 'Uploading…' : 'Save Photo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
