'use client';
import { useRef, useEffect, useState } from 'react';
import { FilterState, fetchOverseasCountries } from '@/lib/supabase';

const CASTE_GROUPS: Record<string, string[]> = {
  'Other': ['Other'],
  'Punjab': ['Jatt / Jat','Rajput','Arain','Gujjar','Sheikh','Syed','Mughal','Malik','Awan','Bhatti','Khokhar','Dogar','Tiwana','Kamboh','Ansari','Qureshi'],
  'Sindh': ['Sindhi Syed','Soomro','Junejo','Memon','Lohana','Khuhro','Chandio','Brohi','Abbasi','Jatoi','Palijo'],
  'Balochistan': ['Bugti','Marri','Mengal','Rind','Raisani'],
  'KPK / Pashtun': ['Afridi','Yousafzai','Khattak','Shinwari','Bangash','Mohmand','Wazir','Mehsud','Tareen'],
  'Kashmir & Northern': ['Butt','Dar','Lone','Mir','Chaudhry','Raja'],
  'Urdu-speaking / Muhajir': ['Siddiqui','Farooqui','Usmani','Rizvi','Zaidi','Memon'],
};
const CASTES = Object.values(CASTE_GROUPS).flat();
const SECTS = ['Sunni','Shia','Barelvi','Deobandi','Ahl-e-Hadith','Other'];
const EDUCATIONS = ['Matric','FSc/FA','Diploma',"Bachelor's","Master's",'MPhil','PhD','Other'];
const MARITAL_MALE   = ['Never married','Married','Divorced','Widowed'];
const MARITAL_FEMALE = ['Never married','Divorced','Khula','Widowed'];
const MARITAL_ALL    = ['Never married','Married','Divorced','Khula','Widowed'];

// Age range for the filter dropdowns — matches the existing 18–80 bounds
// that were previously enforced via input min/max attributes.
const AGE_OPTIONS: number[] = Array.from({ length: 80 - 18 + 1 }, (_, i) => 18 + i);

// Height range for the filter dropdowns, in the same total-inches unit
// height_inches is stored in — 4'0" (48") through 7'0" (84"), labeled the
// same ft/in way the rest of the site displays height.
const HEIGHT_OPTIONS: { inches: number; label: string }[] = Array.from({ length: 84 - 48 + 1 }, (_, i) => {
  const inches = 48 + i;
  return { inches, label: `${Math.floor(inches / 12)}'${inches % 12}"` };
});

const PROFESSIONS: Record<string, string[]> = {
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

const PAKISTAN_CITIES: Record<string, string[]> = {
  'Punjab': ['Lahore','Faisalabad','Rawalpindi','Multan','Gujranwala','Sialkot','Bahawalpur','Sargodha','Sheikhupura','Rahim Yar Khan','Jhelum','Gujrat','Okara','Sahiwal','Khanewal','Vehari','Kasur','Dera Ghazi Khan','Layyah','Mianwali','Bhakkar','Toba Tek Singh','Chiniot','Hafizabad','Lodhran','Muzaffargarh','Rajanpur','Bahawalnagar','Pasrur','Wazirabad','Pakpattan','Narowal','Attock','Chakwal','Murree','Jhang','Wah','Burewala','Kamoke','Sadiqabad','Muridke','Khanpur','Mandi Bahauddin','Daska','Gojra','Ahmedpur East','Chishtian','Samundri','Ferozwala','Jaranwala','Hasilpur','Kamalia','Kot Abdul Malik','Arif Wala','Jampur','Jatoi','Shujabad','Haroonabad','Jalalpur Jattan','Kot Addu','Mian Channu','Khushab','Taxila','Shakargarh','Mailsi','Dipalpur','Haveli Lakha','Lala Musa','Sambrial','Bhalwal','Taunsa','Phool Nagar','Pattoki','Jauharabad','Chichawatni','Farooqabad','Sangla Hill','Gujar Khan','Kharian','Kot Radha Kishan','Ludhewala Waraich','Renala Khurd'],
  'Sindh': ['Karachi','Hyderabad','Sukkur','Larkana','Mirpur Khas','Khairpur','Nawabshah','Badin','Thatta','Jamshoro','Sanghar','Ghotki','Jacobabad','Shikarpur','Dadu','Tando Adam','Tando Allahyar','Bholari','Umerkot','Moro','Shahdadkot','Tando Muhammad Khan','Shahdadpur','Kamber Ali Khan','Kotri'],
  'KPK': ['Peshawar','Mardan','Mingora','Abbottabad','Kohat','Dera Ismail Khan','Bannu','Chitral','Mansehra','Haripur','Swabi','Nowshera','Charsadda','Kabal','Barikot','Shabqadar'],
  'Balochistan': ['Quetta','Gwadar','Turbat','Khuzdar','Chaman','Sibi','Zhob','Hub','Panjgur','Pishin','Dera Murad Jamali'],
  'Islamabad': ['Islamabad'],
  'Gilgit Baltistan': ['Gilgit','Skardu','Hunza'],
  'Azad Kashmir': ['Muzaffarabad','Mirpur','Rawalakot','Kotli','Bagh'],
};


function ProfessionSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const categories = Object.keys(PROFESSIONS);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <select
        value={value || ''}
        onChange={e => {
          if (e.target.value === '') { onChange(''); return; }
          onChange(e.target.value);
          setOpen(false);
        }}
        onClick={e => { e.preventDefault(); setOpen(!open); }}
        style={{
          padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E8E6F5',
          background: value ? '#EEEDFE' : '#fff', color: value ? '#534AB7' : '#6B6893',
          fontSize: 13, fontWeight: value ? 700 : 500, cursor: 'pointer', outline: 'none', minWidth: 100,
        }}
      >
        <option value="">{value || 'Occupation'}</option>
      </select>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#fff', border: '1px solid #E8E6F5', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 200,
          minWidth: 180, overflow: 'hidden',
        }}>
          <div onClick={() => { onChange(''); setOpen(false); }}
            style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: '#6B6893',
              borderBottom: '1px solid #F5F5F5' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F7FF'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
            All Professions
          </div>
          {categories.map(cat => (
            <div key={cat} onClick={() => { onChange(cat); setOpen(false); }}
              style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                color: value === cat ? '#534AB7' : '#1A1830',
                fontWeight: value === cat ? 700 : 400,
                background: value === cat ? '#EEEDFE' : 'transparent' }}
              onMouseEnter={e => { if (value !== cat) (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
              onMouseLeave={e => { if (value !== cat) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              {cat}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = { filters: FilterState; onChange: (f: FilterState) => void; total: number; showSaved?: boolean; onSavedToggle?: () => void; lockedGender?: 'Male' | 'Female' | null; };

function Select({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '8px 10px', borderRadius: 10, border: '1.5px solid #E8E6F5',
        background: value ? '#EEEDFE' : '#fff', color: value ? '#534AB7' : '#6B6893',
        fontSize: 13, fontWeight: value ? 700 : 500, cursor: 'pointer', outline: 'none', flex: '1 1 auto', minWidth: 0,
      }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// Small click-to-open info icon — same pattern as the one used on the
// registration form and My Account edit screen (InfoPopover), just scaled
// down to fit inline in the compact filter bar. Can't put this inside the
// <select> itself (native selects can't host arbitrary HTML), so it sits
// as its own tiny button right next to the field it explains.
function FilterInfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #C4C2D8', background: '#fff', color: '#6B6893', fontSize: 11, fontWeight: 700, lineHeight: '18px', cursor: 'pointer', padding: 0 }}
        aria-label="More info">i</button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 26, right: 0, zIndex: 210, width: 220, background: '#40359F', color: '#fff', fontSize: 12, fontWeight: 500, lineHeight: 1.5, borderRadius: 10, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          {text}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({ filters, onChange, total, showSaved, onSavedToggle, lockedGender }: Props) {
  const [showMore, setShowMore] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // 'overseas' | 'pakistan' | ''
  const [locationMode, setLocationMode] = useState<string>(() => filters.overseas ? 'overseas' : filters.city ? 'pakistan' : '');
  const [selectedCity, setSelectedCity] = useState<string>(filters.city || '');
  const [overseasCountries, setOverseasCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>(filters.country || '');

  // If arriving with overseas filter (e.g. from country slider), fetch countries immediately
  useEffect(() => {
    if (filters.overseas && overseasCountries.length === 0) {
      fetchOverseasCountries().then(setOverseasCountries);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't count the gender filter toward the active-filter badge when it's
  // locked — the user didn't choose it, so it shouldn't look like a filter
  // they can/need to clear. Matches the mobile app's _effectiveCount.
  const activeCount = Object.entries(filters).filter(([k, v]) =>
    v !== undefined && v !== '' && !(k === 'gender' && lockedGender)
  ).length;

  const set = (key: keyof FilterState, val: string) =>
    onChange({ ...filters, [key]: val || undefined });

  const handleLocationMode = (mode: string) => {
    setLocationMode(mode);
    setSelectedCity('');
    setSelectedCountry('');
    if (mode === 'overseas') {
      onChange({ ...filters, overseas: true, city: undefined, country: undefined });
      fetchOverseasCountries().then(setOverseasCountries);
    } else {
      onChange({ ...filters, overseas: undefined, city: undefined, country: undefined });
    }
  };

  const handleCountryChange = (c: string) => {
    setSelectedCountry(c);
    onChange({ ...filters, overseas: true, country: c || undefined });
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    onChange({ ...filters, city: city || undefined });
  };

  const handleClear = () => {
    setLocationMode('');
    setSelectedCity('');
    setSelectedCountry('');
    setOverseasCountries([]);
    // A locked gender isn't a real filter choice to clear — keep it.
    onChange(lockedGender ? { gender: lockedGender } : {});
  };

  const dropStyle = (active: boolean) => ({
    padding: '8px 10px', borderRadius: 10, border: '1.5px solid #E8E6F5',
    background: active ? '#EEEDFE' : '#fff', color: active ? '#534AB7' : '#6B6893',
    fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', outline: 'none', flex: '1 1 auto', minWidth: 0,
  });

  const genderToggle = lockedGender ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F5F5F5', borderRadius: 10, padding: '6px 12px', cursor: 'default' }}
      title="Locked — you can only browse the opposite gender">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B6893" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
      {lockedGender === 'Male' ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#534AB7' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="6"/><line x1="17.5" y1="5.5" x2="22" y2="2"/><line x1="22" y1="2" x2="19" y2="2"/><line x1="22" y1="2" x2="22" y2="5"/>
          </svg>
          Male
        </span>
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#534AB7' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="6"/><line x1="12" y1="14" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/>
          </svg>
          Female
        </span>
      )}
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 4, background: '#F5F5F5', borderRadius: 10, padding: 3 }}>
      {(['Male', 'Female'] as string[]).map(g => (
        <button key={g} onClick={() => set('gender', (filters.gender === g ? '' : g))} style={{
          padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: filters.gender === g ? '#534AB7' : 'transparent',
          color: filters.gender === g ? '#fff' : '#6B6893',
        }}>
          {g === 'Male' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="6"/><line x1="17.5" y1="5.5" x2="22" y2="2"/><line x1="22" y1="2" x2="19" y2="2"/><line x1="22" y1="2" x2="22" y2="5"/>
              </svg>
              Male
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="6"/><line x1="12" y1="14" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/>
              </svg>
              Female
            </span>
          )}
        </button>
      ))}
    </div>
  );

  const allSelects = (
    <>
      <select value={locationMode} onChange={e => handleLocationMode(e.target.value)} style={dropStyle(!!locationMode)}>
        <option value="">Location</option>
        <option value="overseas">Overseas</option>
        <option value="pakistan">Pakistan</option>
      </select>
      {locationMode === 'pakistan' && (
        <select value={selectedCity} onChange={e => handleCityChange(e.target.value)} style={dropStyle(!!selectedCity)}>
          <option value="">All Cities</option>
          {Object.entries(PAKISTAN_CITIES).map(([province, cities]) => (
            <optgroup key={province} label={province}>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          ))}
        </select>
      )}
      {locationMode === 'overseas' && (
        <select value={selectedCountry} onChange={e => handleCountryChange(e.target.value)} style={dropStyle(!!selectedCountry)}>
          <option value="">All Countries</option>
          {overseasCountries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      <select value={filters.caste || ''} onChange={e => set('caste', e.target.value)} style={dropStyle(!!filters.caste)}>
        <option value="">Caste</option>
        {Object.entries(CASTE_GROUPS).flatMap(([group, castes]) =>
          castes.map(c => <option key={`${group}-${c}`} value={c}>{c}</option>)
        )}
      </select>
      <Select label="Sect" value={filters.sect} options={SECTS} onChange={v => set('sect', v)} />
      <Select label="Marital Status" value={filters.maritalStatus} options={filters.gender === 'Male' ? MARITAL_MALE : filters.gender === 'Female' ? MARITAL_FEMALE : MARITAL_ALL} onChange={v => set('maritalStatus', v)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 160px' }}>
        <select value={filters.minAge || ''} onChange={e => onChange({ ...filters, minAge: e.target.value ? +e.target.value : undefined })}
          style={{ flex: 1, minWidth: 0, padding: '8px 4px', borderRadius: 10, border: '1.5px solid #E8E6F5', background: filters.minAge ? '#EEEDFE' : '#fff', color: filters.minAge ? '#534AB7' : '#6B6893', fontSize: 13, fontWeight: filters.minAge ? 700 : 500, outline: 'none', textAlign: 'center', cursor: 'pointer' }}>
          <option value="">Min age</option>
          {AGE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ color: '#68629C', fontSize: 12 }}>–</span>
        <select value={filters.maxAge || ''} onChange={e => onChange({ ...filters, maxAge: e.target.value ? +e.target.value : undefined })}
          style={{ flex: 1, minWidth: 0, padding: '8px 4px', borderRadius: 10, border: '1.5px solid #E8E6F5', background: filters.maxAge ? '#EEEDFE' : '#fff', color: filters.maxAge ? '#534AB7' : '#6B6893', fontSize: 13, fontWeight: filters.maxAge ? 700 : 500, outline: 'none', textAlign: 'center', cursor: 'pointer' }}>
          <option value="">Max age</option>
          {AGE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {/* Forces everything after this onto a new row — flex-wrap alone
          only wraps once it runs out of width, so on wide screens Home
          Type (and everything after it) would otherwise get pulled up
          into row 1 instead of staying on row 2. */}
      <div style={{ flexBasis: '100%', width: 0, height: 0 }} />
      <select value={filters.homeType || ''} onChange={e => set('homeType', e.target.value)} style={dropStyle(!!filters.homeType)}>
        <option value="">Home Type</option>
        <option value="Own House">Own House</option>
        <option value="Rented House">Rented House</option>
      </select>
      <Select label="Occupation" value={filters.profession} options={Object.keys(PROFESSIONS)} onChange={v => set('profession', v)} />
      <Select label="Education" value={filters.education} options={EDUCATIONS} onChange={v => set('education', v)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '2 1 220px' }}>
        <select value={filters.minHeight || ''} onChange={e => onChange({ ...filters, minHeight: e.target.value ? +e.target.value : undefined })}
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: '1.5px solid #E8E6F5', background: filters.minHeight ? '#EEEDFE' : '#fff', color: filters.minHeight ? '#534AB7' : '#6B6893', fontSize: 13, fontWeight: filters.minHeight ? 700 : 500, outline: 'none', textAlign: 'center', cursor: 'pointer' }}>
          <option value="">Min Height</option>
          {HEIGHT_OPTIONS.map(h => <option key={h.inches} value={h.inches}>{h.label}</option>)}
        </select>
        <span style={{ color: '#68629C', fontSize: 12 }}>–</span>
        <select value={filters.maxHeight || ''} onChange={e => onChange({ ...filters, maxHeight: e.target.value ? +e.target.value : undefined })}
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: '1.5px solid #E8E6F5', background: filters.maxHeight ? '#EEEDFE' : '#fff', color: filters.maxHeight ? '#534AB7' : '#6B6893', fontSize: 13, fontWeight: filters.maxHeight ? 700 : 500, outline: 'none', textAlign: 'center', cursor: 'pointer' }}>
          <option value="">Max Height</option>
          {HEIGHT_OPTIONS.map(h => <option key={h.inches} value={h.inches}>{h.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 0 }}>
        <Select label="Open to Polygamy" value={filters.openToPolygamy} options={['Yes', 'No']} onChange={v => set('openToPolygamy', v)} />
        <FilterInfoIcon text="Polygamy means marrying more than one woman (for men) or marrying a man who already has a wife (for women)." />
      </div>
    </>
  );

  const searchBox = (
    <div style={{ position: 'relative' }}>
      <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Search by name, city, profession..." value={filters.search || ''} onChange={e => set('search', e.target.value)}
        style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 12, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', background: '#FAF9FF', color: '#1A1830' }} />
    </div>
  );

  return (
    <>
      {/* ── Desktop filter bar ── */}
      <div className="filter-desktop" style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ marginBottom: 12 }}>{searchBox}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {genderToggle}
          {allSelects}
          {activeCount > 0 && (
            <button onClick={handleClear} style={{ padding: '7px 12px', borderRadius: 10, border: '1.5px solid #E11D48', background: '#FFE4E6', color: '#E11D48', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✕ Clear ({activeCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile: search + filter button ── */}
      <div className="filter-mobile" style={{ marginBottom: 16, gap: 8 }}>
        <div style={{ flex: 1 }}>{searchBox}</div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => setMobileFiltersOpen(true)} style={{
            padding: '10px 16px', borderRadius: 12,
            border: `1.5px solid ${activeCount > 0 ? '#534AB7' : '#E8E6F5'}`,
            background: activeCount > 0 ? '#EEEDFE' : '#fff',
            color: activeCount > 0 ? '#534AB7' : '#6B6893',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            ⚙ {activeCount > 0 ? `(${activeCount})` : 'Filter'}
          </button>
          {onSavedToggle && <button onClick={onSavedToggle} style={{
            padding: '10px 12px', borderRadius: 12,
            border: `1.5px solid ${showSaved ? '#E11D48' : '#E8E6F5'}`,
            background: showSaved ? '#FEE2E2' : '#fff',
            color: showSaved ? '#E11D48' : '#6B6893',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {showSaved ? '❤️' : '🤍'}
          </button>}
        </div>
      </div>

      {/* ── Mobile bottom sheet ── */}
      {mobileFiltersOpen && (
        <div className="filter-mobile" style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.4)', alignItems: 'flex-end',
        }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>Filters</span>
              <button onClick={() => setMobileFiltersOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B6893', padding: '0 4px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {genderToggle}
              {allSelects}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {activeCount > 0 && (
                <button onClick={() => { handleClear(); setMobileFiltersOpen(false); }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #E11D48', background: '#FFE4E6', color: '#E11D48', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Clear All
                </button>
              )}
              <button onClick={() => setMobileFiltersOpen(false)} style={{ flex: 2, padding: '12px', borderRadius: 12, background: '#534AB7', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
