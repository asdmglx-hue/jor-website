'use client';
import { useRef, useEffect, useState } from 'react';
import { FilterState, fetchOverseasCountries, fetchCastes, fetchOccupations, fetchCities } from '@/lib/supabase';
import { CITY_GROUPS } from '@/lib/constants';

// Was a locally hand-typed duplicate of the same list now in
// lib/constants.ts — derived here instead so it can't drift out of sync
// with the registration form or the Featured booking modal again. 'Other'
// is excluded since filtering the browse page by "Other" isn't meaningful.
const PAKISTAN_CITIES: Record<string, string[]> = Object.fromEntries(
  Object.entries(CITY_GROUPS).filter(([province]) => province !== 'Other')
);

// ── Hardcoded fallbacks (used until DB fetch resolves on first load) ─────────
const CASTE_GROUPS_FALLBACK: Record<string, string[]> = {
  'Punjab': ['Jatt','Rajput','Arain','Gujjar','Sheikh','Syed','Mughal','Malik','Awan','Bhatti','Khokhar','Dogar','Tiwana','Kamboh','Ansari','Qureshi','Kayani','Chohan','Janjua','Randhawa','Rana','Warraich','Ghumman','Gondal','Toor','Satti','Bajwa','Chattha','Hanjra','Wattoo','Sipra','Siyal','Gakhar','Ranjha'],
  'Sindh': ['Sindhi Syed','Soomro','Junejo','Memon','Lohana','Khuhro','Chandio','Brohi','Abbasi','Jatoi','Palijo'],
  'KPK / Pashtun': ['Afridi','Yousafzai','Khattak','Shinwari','Bangash','Mohmand','Wazir','Mehsud','Tareen','Pathan','Pashtun','Khan','Niazi','Kakazai','Tanoli'],
  'Kashmir & Northern': ['Butt','Dar','Lone','Mir','Chaudhry','Raja','Kashmiri','Khawaja'],
  'Balochistan': ['Bugti','Marri','Mengal','Rind','Raisani','Lashari','Baloch'],
  'Urdu-speaking / Muhajir': ['Siddiqui','Farooqui','Usmani','Rizvi','Zaidi','Hashmi','Rehmani','Paracha','Alvi','Pirzada'],
  'General': ['Ghauri','Mirza','Baig','Chughtai','Qazi','Sherwani','Other'],
};
const OCCUPATION_CATEGORIES_FALLBACK = [
  'Healthcare','Engineering','IT & Tech','Education','Finance & Law',
  'Business & Management','Government & Forces','Arts & Media',
  'Skilled Trades','Services & Other','Other',
];
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
  const [cityGroups, setCityGroups] = useState<Record<string, string[]>>(Object.fromEntries(Object.entries(PAKISTAN_CITIES)));
  const [casteGroups, setCasteGroups] = useState<Record<string, string[]>>(CASTE_GROUPS_FALLBACK);
  const [occupationCategories, setOccupationCategories] = useState<string[]>(OCCUPATION_CATEGORIES_FALLBACK);

  // Fetch castes and occupations from DB on mount — same single source of
  // truth as the user app. Falls back to the hardcoded lists above if the
  // fetch fails or hasn't resolved yet.
  useEffect(() => {
    fetchCities().then(data => { if (Object.keys(data).length > 0) setCityGroups(data); });
    fetchCastes().then(data => { if (Object.keys(data).length > 0) setCasteGroups(data); });
    fetchOccupations().then(data => {
      if (Object.keys(data).length > 0) {
        const cats = Object.keys(data).filter(k => k !== 'Other');
        cats.push('Other');
        setOccupationCategories(cats);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      onChange({ ...filters, overseas: true, pakistan: undefined, city: undefined, country: undefined });
      fetchOverseasCountries().then(setOverseasCountries);
    } else if (mode === 'pakistan') {
      onChange({ ...filters, overseas: undefined, pakistan: true, city: undefined, country: undefined });
    } else {
      onChange({ ...filters, overseas: undefined, pakistan: undefined, city: undefined, country: undefined });
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
          {Object.entries(cityGroups).map(([province, cities]) => (
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
        {Object.entries(casteGroups).flatMap(([group, castes]) =>
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
      <Select label="Occupation" value={filters.profession} options={occupationCategories} onChange={v => set('profession', v)} />
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
