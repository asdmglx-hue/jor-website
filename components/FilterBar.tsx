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
const SECTS = ['Sunni','Shia','Ahl-e-Hadith','Deobandi','Barelvi','Other'];
const EDUCATIONS = ['Matric','FSc/FA','Diploma',"Bachelor's","Master's",'MPhil','PhD','Other'];
const MARITAL_MALE   = ['Never married','Married','Divorced','Widowed'];
const MARITAL_FEMALE = ['Never married','Divorced','Khula','Widowed'];
const MARITAL_ALL    = ['Never married','Married','Divorced','Khula','Widowed'];

// Age range for the filter dropdowns — matches the app's 18–100 range.
const AGE_OPTIONS: number[] = Array.from({ length: 100 - 18 + 1 }, (_, i) => 18 + i);

// Height range for the filter dropdowns, in the same total-inches unit
// height_inches is stored in — 4'0" (48") through 8'0" (96"), labeled the
// same ft/in way the rest of the site displays height. Matches the app's
// 48–96 range.
const HEIGHT_OPTIONS: { inches: number; label: string }[] = Array.from({ length: 96 - 48 + 1 }, (_, i) => {
  const inches = 48 + i;
  return { inches, label: `${Math.floor(inches / 12)}'${inches % 12}"` };
});

type Props = { filters: FilterState; onChange: (f: FilterState) => void; total: number; showSaved?: boolean; onSavedToggle?: () => void; lockedGender?: 'Male' | 'Female' | null; };

// Multi-select dropdown — checkbox list in a popover, matching the visual
// style of the single-select `Select` above. Supports both a flat option
// list (`options`) and grouped options with a section header per group
// (`groups`, e.g. castes-by-region or cities-by-province) — pass exactly
// one of the two. This is what gives the website the same "pick more than
// one" behavior the app has always had for city/caste/sect/occupation/
// marital status/education/home type (those filters used to only allow
// picking a single value here, unlike the app).
function MultiSelect({ label, values, options, groups, onChange }: {
  label: string;
  values: string[];
  options?: string[];
  groups?: Record<string, string[]>;
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const toggle = (opt: string) => {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
  };

  const active = values.length > 0;
  const displayLabel = values.length === 0 ? label : values.length === 1 ? values[0] : `${label} (${values.length})`;
  const entries: [string, string[]][] = groups ? Object.entries(groups) : [['', options || []]];

  return (
    <div ref={ref} style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o); }} style={{
        width: '100%', padding: '8px 10px', borderRadius: 10, border: '1.5px solid #E8E6F5',
        background: active ? '#EEEDFE' : '#fff', color: active ? '#534AB7' : '#6B6893',
        fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', outline: 'none',
        textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <span style={{ fontSize: 10, flexShrink: 0, color: active ? '#534AB7' : '#9A97B8' }}>▾</span>
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 220,
          background: '#fff', border: '1.5px solid #E8E6F5', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto',
          minWidth: 210, padding: '6px 0',
        }}>
          {active && (
            <button type="button" onClick={() => onChange([])} style={{
              width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none',
              color: '#E11D48', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderBottom: '1px solid #F0EFFA',
            }}>
              Clear ({values.length})
            </button>
          )}
          {entries.map(([group, opts]) => (
            <div key={group || 'flat'}>
              {group && (
                <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 800, color: '#9A97B8', textTransform: 'uppercase' }}>
                  {group}
                </div>
              )}
              {opts.map(opt => (
                <label key={opt} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  color: values.includes(opt) ? '#534AB7' : '#1A1830', fontWeight: values.includes(opt) ? 700 : 500,
                }}>
                  <input type="checkbox" checked={values.includes(opt)} onChange={() => toggle(opt)}
                    style={{ accentColor: '#534AB7', width: 14, height: 14, cursor: 'pointer' }} />
                  {opt}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
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
  const [locationMode, setLocationMode] = useState<string>(() => filters.overseas ? 'overseas' : (filters.city || (filters.cities && filters.cities.length > 0)) ? 'pakistan' : '');
  const [selectedCities, setSelectedCities] = useState<string[]>(() => filters.cities || (filters.city ? [filters.city] : []));
  const [overseasCountries, setOverseasCountries] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(() => filters.countries || (filters.country ? [filters.country] : []));

  // If arriving with overseas filter (e.g. from country slider), fetch countries immediately
  useEffect(() => {
    if (filters.overseas && overseasCountries.length === 0) {
      fetchOverseasCountries().then(setOverseasCountries);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't count the gender filter toward the active-filter badge when it's
  // locked — the user didn't choose it, so it shouldn't look like a filter
  // they can/need to clear. Matches the mobile app's _effectiveCount. Empty
  // arrays (a multi-select with nothing picked) don't count as active —
  // only non-empty ones do, same as the app's activeCount getter.
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (k === 'gender' && lockedGender) return false;
    return true;
  }).length;

  const set = (key: keyof FilterState, val: string) =>
    onChange({ ...filters, [key]: val || undefined });

  // Shared handler for every multi-select filter (caste, sect, marital
  // status, education, profession, home type) — writes the new array
  // straight into filters under `key`, using undefined instead of an
  // empty array when nothing's selected so activeCount/URL params stay
  // clean (matches how the single-select `set()` above uses undefined
  // instead of an empty string).
  const setMulti = (key: keyof FilterState, values: string[]) =>
    onChange({ ...filters, [key]: values.length > 0 ? values : undefined });

  const handleCitiesChange = (cities: string[]) => {
    setSelectedCities(cities);
    onChange({ ...filters, city: undefined, cities: cities.length > 0 ? cities : undefined });
  };

  const handleLocationMode = (mode: string) => {
    setLocationMode(mode);
    setSelectedCities([]);
    setSelectedCountries([]);
    if (mode === 'overseas') {
      onChange({ ...filters, overseas: true, pakistan: undefined, city: undefined, cities: undefined, country: undefined, countries: undefined });
      fetchOverseasCountries().then(setOverseasCountries);
    } else if (mode === 'pakistan') {
      onChange({ ...filters, overseas: undefined, pakistan: true, city: undefined, cities: undefined, country: undefined, countries: undefined });
    } else {
      onChange({ ...filters, overseas: undefined, pakistan: undefined, city: undefined, cities: undefined, country: undefined, countries: undefined });
    }
  };

  const handleCountriesChange = (countries: string[]) => {
    setSelectedCountries(countries);
    onChange({ ...filters, overseas: true, country: undefined, countries: countries.length > 0 ? countries : undefined });
  };

  const handleClear = () => {
    setLocationMode('');
    setSelectedCities([]);
    setSelectedCountries([]);
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
        <MultiSelect label="All Cities" values={selectedCities} groups={cityGroups} onChange={handleCitiesChange} />
      )}
      {locationMode === 'overseas' && (
        <MultiSelect label="All Countries" values={selectedCountries} options={overseasCountries} onChange={handleCountriesChange} />
      )}
      <MultiSelect label="Caste" values={filters.castes || []} groups={casteGroups} onChange={v => setMulti('castes', v)} />
      <MultiSelect label="Sect" values={filters.sects || []} options={SECTS} onChange={v => setMulti('sects', v)} />
      <MultiSelect label="Marital Status" values={filters.maritalStatuses || []} options={filters.gender === 'Male' ? MARITAL_MALE : filters.gender === 'Female' ? MARITAL_FEMALE : MARITAL_ALL} onChange={v => setMulti('maritalStatuses', v)} />
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
      <MultiSelect label="Home Type" values={filters.homeTypes || []} options={['Own House', 'Rented House']} onChange={v => setMulti('homeTypes', v)} />
      <MultiSelect label="Occupation" values={filters.professions || []} options={occupationCategories} onChange={v => setMulti('professions', v)} />
      <MultiSelect label="Education" values={filters.educations || []} options={EDUCATIONS} onChange={v => setMulti('educations', v)} />
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
