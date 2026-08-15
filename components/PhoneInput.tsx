'use client';
import { useState, useRef, useEffect } from 'react';

type DialCode = { flag: string; name: string; code: string };
function flagToISO(flag: string): string {
  return [...flag].map(c => String.fromCharCode(c.codePointAt(0)! - 127397)).join('').toLowerCase();
}

const DIAL_CODES: DialCode[] = [
  { flag:'🇵🇰', name:'Pakistan',                code:'+92'  },
  { flag:'🇦🇫', name:'Afghanistan',             code:'+93'  },
  { flag:'🇦🇱', name:'Albania',                 code:'+355' },
  { flag:'🇩🇿', name:'Algeria',                 code:'+213' },
  { flag:'🇦🇩', name:'Andorra',                 code:'+376' },
  { flag:'🇦🇴', name:'Angola',                  code:'+244' },
  { flag:'🇦🇬', name:'Antigua & Barbuda',       code:'+1268'},
  { flag:'🇦🇷', name:'Argentina',               code:'+54'  },
  { flag:'🇦🇲', name:'Armenia',                 code:'+374' },
  { flag:'🇦🇺', name:'Australia',               code:'+61'  },
  { flag:'🇦🇹', name:'Austria',                 code:'+43'  },
  { flag:'🇦🇿', name:'Azerbaijan',              code:'+994' },
  { flag:'🇧🇸', name:'Bahamas',                 code:'+1242'},
  { flag:'🇧🇭', name:'Bahrain',                 code:'+973' },
  { flag:'🇧🇩', name:'Bangladesh',              code:'+880' },
  { flag:'🇧🇧', name:'Barbados',                code:'+1246'},
  { flag:'🇧🇾', name:'Belarus',                 code:'+375' },
  { flag:'🇧🇪', name:'Belgium',                 code:'+32'  },
  { flag:'🇧🇿', name:'Belize',                  code:'+501' },
  { flag:'🇧🇯', name:'Benin',                   code:'+229' },
  { flag:'🇧🇹', name:'Bhutan',                  code:'+975' },
  { flag:'🇧🇴', name:'Bolivia',                 code:'+591' },
  { flag:'🇧🇦', name:'Bosnia & Herzegovina',    code:'+387' },
  { flag:'🇧🇼', name:'Botswana',                code:'+267' },
  { flag:'🇧🇷', name:'Brazil',                  code:'+55'  },
  { flag:'🇧🇳', name:'Brunei',                  code:'+673' },
  { flag:'🇧🇬', name:'Bulgaria',                code:'+359' },
  { flag:'🇧🇫', name:'Burkina Faso',            code:'+226' },
  { flag:'🇧🇮', name:'Burundi',                 code:'+257' },
  { flag:'🇨🇻', name:'Cabo Verde',              code:'+238' },
  { flag:'🇰🇭', name:'Cambodia',                code:'+855' },
  { flag:'🇨🇲', name:'Cameroon',                code:'+237' },
  { flag:'🇨🇦', name:'Canada',                  code:'+1'   },
  { flag:'🇨🇫', name:'Central African Republic',code:'+236' },
  { flag:'🇹🇩', name:'Chad',                    code:'+235' },
  { flag:'🇨🇱', name:'Chile',                   code:'+56'  },
  { flag:'🇨🇳', name:'China',                   code:'+86'  },
  { flag:'🇨🇴', name:'Colombia',                code:'+57'  },
  { flag:'🇰🇲', name:'Comoros',                 code:'+269' },
  { flag:'🇨🇬', name:'Congo',                   code:'+242' },
  { flag:'🇨🇩', name:'Congo (DR)',              code:'+243' },
  { flag:'🇨🇷', name:'Costa Rica',              code:'+506' },
  { flag:'🇭🇷', name:'Croatia',                 code:'+385' },
  { flag:'🇨🇺', name:'Cuba',                    code:'+53'  },
  { flag:'🇨🇾', name:'Cyprus',                  code:'+357' },
  { flag:'🇨🇿', name:'Czech Republic',          code:'+420' },
  { flag:'🇩🇰', name:'Denmark',                 code:'+45'  },
  { flag:'🇩🇯', name:'Djibouti',                code:'+253' },
  { flag:'🇩🇲', name:'Dominica',                code:'+1767'},
  { flag:'🇩🇴', name:'Dominican Republic',      code:'+1809'},
  { flag:'🇪🇨', name:'Ecuador',                 code:'+593' },
  { flag:'🇪🇬', name:'Egypt',                   code:'+20'  },
  { flag:'🇸🇻', name:'El Salvador',             code:'+503' },
  { flag:'🇬🇶', name:'Equatorial Guinea',       code:'+240' },
  { flag:'🇪🇷', name:'Eritrea',                 code:'+291' },
  { flag:'🇪🇪', name:'Estonia',                 code:'+372' },
  { flag:'🇸🇿', name:'Eswatini',                code:'+268' },
  { flag:'🇪🇹', name:'Ethiopia',                code:'+251' },
  { flag:'🇫🇯', name:'Fiji',                    code:'+679' },
  { flag:'🇫🇮', name:'Finland',                 code:'+358' },
  { flag:'🇫🇷', name:'France',                  code:'+33'  },
  { flag:'🇬🇦', name:'Gabon',                   code:'+241' },
  { flag:'🇬🇲', name:'Gambia',                  code:'+220' },
  { flag:'🇬🇪', name:'Georgia',                 code:'+995' },
  { flag:'🇩🇪', name:'Germany',                 code:'+49'  },
  { flag:'🇬🇭', name:'Ghana',                   code:'+233' },
  { flag:'🇬🇷', name:'Greece',                  code:'+30'  },
  { flag:'🇬🇩', name:'Grenada',                 code:'+1473'},
  { flag:'🇬🇹', name:'Guatemala',               code:'+502' },
  { flag:'🇬🇳', name:'Guinea',                  code:'+224' },
  { flag:'🇬🇼', name:'Guinea-Bissau',           code:'+245' },
  { flag:'🇬🇾', name:'Guyana',                  code:'+592' },
  { flag:'🇭🇹', name:'Haiti',                   code:'+509' },
  { flag:'🇭🇳', name:'Honduras',                code:'+504' },
  { flag:'🇭🇺', name:'Hungary',                 code:'+36'  },
  { flag:'🇮🇸', name:'Iceland',                 code:'+354' },
  { flag:'🇮🇳', name:'India',                   code:'+91'  },
  { flag:'🇮🇩', name:'Indonesia',               code:'+62'  },
  { flag:'🇮🇷', name:'Iran',                    code:'+98'  },
  { flag:'🇮🇶', name:'Iraq',                    code:'+964' },
  { flag:'🇮🇪', name:'Ireland',                 code:'+353' },
  { flag:'🇮🇹', name:'Italy',                   code:'+39'  },
  { flag:'🇯🇲', name:'Jamaica',                 code:'+1876'},
  { flag:'🇯🇵', name:'Japan',                   code:'+81'  },
  { flag:'🇯🇴', name:'Jordan',                  code:'+962' },
  { flag:'🇰🇿', name:'Kazakhstan',              code:'+7'   },
  { flag:'🇰🇪', name:'Kenya',                   code:'+254' },
  { flag:'🇰🇮', name:'Kiribati',                code:'+686' },
  { flag:'🇽🇰', name:'Kosovo',                  code:'+383' },
  { flag:'🇰🇼', name:'Kuwait',                  code:'+965' },
  { flag:'🇰🇬', name:'Kyrgyzstan',              code:'+996' },
  { flag:'🇱🇦', name:'Laos',                    code:'+856' },
  { flag:'🇱🇻', name:'Latvia',                  code:'+371' },
  { flag:'🇱🇧', name:'Lebanon',                 code:'+961' },
  { flag:'🇱🇸', name:'Lesotho',                 code:'+266' },
  { flag:'🇱🇷', name:'Liberia',                 code:'+231' },
  { flag:'🇱🇾', name:'Libya',                   code:'+218' },
  { flag:'🇱🇮', name:'Liechtenstein',           code:'+423' },
  { flag:'🇱🇹', name:'Lithuania',               code:'+370' },
  { flag:'🇱🇺', name:'Luxembourg',              code:'+352' },
  { flag:'🇲🇬', name:'Madagascar',              code:'+261' },
  { flag:'🇲🇼', name:'Malawi',                  code:'+265' },
  { flag:'🇲🇾', name:'Malaysia',                code:'+60'  },
  { flag:'🇲🇻', name:'Maldives',                code:'+960' },
  { flag:'🇲🇱', name:'Mali',                    code:'+223' },
  { flag:'🇲🇹', name:'Malta',                   code:'+356' },
  { flag:'🇲🇭', name:'Marshall Islands',        code:'+692' },
  { flag:'🇲🇷', name:'Mauritania',              code:'+222' },
  { flag:'🇲🇺', name:'Mauritius',               code:'+230' },
  { flag:'🇲🇽', name:'Mexico',                  code:'+52'  },
  { flag:'🇫🇲', name:'Micronesia',              code:'+691' },
  { flag:'🇲🇩', name:'Moldova',                 code:'+373' },
  { flag:'🇲🇨', name:'Monaco',                  code:'+377' },
  { flag:'🇲🇳', name:'Mongolia',                code:'+976' },
  { flag:'🇲🇪', name:'Montenegro',              code:'+382' },
  { flag:'🇲🇦', name:'Morocco',                 code:'+212' },
  { flag:'🇲🇿', name:'Mozambique',              code:'+258' },
  { flag:'🇲🇲', name:'Myanmar',                 code:'+95'  },
  { flag:'🇳🇦', name:'Namibia',                 code:'+264' },
  { flag:'🇳🇷', name:'Nauru',                   code:'+674' },
  { flag:'🇳🇵', name:'Nepal',                   code:'+977' },
  { flag:'🇳🇱', name:'Netherlands',             code:'+31'  },
  { flag:'🇳🇿', name:'New Zealand',             code:'+64'  },
  { flag:'🇳🇮', name:'Nicaragua',               code:'+505' },
  { flag:'🇳🇪', name:'Niger',                   code:'+227' },
  { flag:'🇳🇬', name:'Nigeria',                 code:'+234' },
  { flag:'🇲🇰', name:'North Macedonia',         code:'+389' },
  { flag:'🇳🇴', name:'Norway',                  code:'+47'  },
  { flag:'🇴🇲', name:'Oman',                    code:'+968' },
  { flag:'🇵🇼', name:'Palau',                   code:'+680' },
  { flag:'🇵🇸', name:'Palestine',               code:'+970' },
  { flag:'🇵🇦', name:'Panama',                  code:'+507' },
  { flag:'🇵🇬', name:'Papua New Guinea',        code:'+675' },
  { flag:'🇵🇾', name:'Paraguay',                code:'+595' },
  { flag:'🇵🇪', name:'Peru',                    code:'+51'  },
  { flag:'🇵🇭', name:'Philippines',             code:'+63'  },
  { flag:'🇵🇱', name:'Poland',                  code:'+48'  },
  { flag:'🇵🇹', name:'Portugal',                code:'+351' },
  { flag:'🇶🇦', name:'Qatar',                   code:'+974' },
  { flag:'🇷🇴', name:'Romania',                 code:'+40'  },
  { flag:'🇷🇺', name:'Russia',                  code:'+7'   },
  { flag:'🇷🇼', name:'Rwanda',                  code:'+250' },
  { flag:'🇰🇳', name:'Saint Kitts & Nevis',     code:'+1869'},
  { flag:'🇱🇨', name:'Saint Lucia',             code:'+1758'},
  { flag:'🇻🇨', name:'Saint Vincent',           code:'+1784'},
  { flag:'🇼🇸', name:'Samoa',                   code:'+685' },
  { flag:'🇸🇲', name:'San Marino',              code:'+378' },
  { flag:'🇸🇹', name:'Sao Tome & Principe',     code:'+239' },
  { flag:'🇸🇦', name:'Saudi Arabia',            code:'+966' },
  { flag:'🇸🇳', name:'Senegal',                 code:'+221' },
  { flag:'🇷🇸', name:'Serbia',                  code:'+381' },
  { flag:'🇸🇨', name:'Seychelles',              code:'+248' },
  { flag:'🇸🇱', name:'Sierra Leone',            code:'+232' },
  { flag:'🇸🇬', name:'Singapore',               code:'+65'  },
  { flag:'🇸🇰', name:'Slovakia',                code:'+421' },
  { flag:'🇸🇮', name:'Slovenia',                code:'+386' },
  { flag:'🇸🇧', name:'Solomon Islands',         code:'+677' },
  { flag:'🇸🇴', name:'Somalia',                 code:'+252' },
  { flag:'🇿🇦', name:'South Africa',            code:'+27'  },
  { flag:'🇸🇸', name:'South Sudan',             code:'+211' },
  { flag:'🇪🇸', name:'Spain',                   code:'+34'  },
  { flag:'🇱🇰', name:'Sri Lanka',               code:'+94'  },
  { flag:'🇸🇩', name:'Sudan',                   code:'+249' },
  { flag:'🇸🇷', name:'Suriname',                code:'+597' },
  { flag:'🇸🇪', name:'Sweden',                  code:'+46'  },
  { flag:'🇨🇭', name:'Switzerland',             code:'+41'  },
  { flag:'🇸🇾', name:'Syria',                   code:'+963' },
  { flag:'🇹🇼', name:'Taiwan',                  code:'+886' },
  { flag:'🇹🇯', name:'Tajikistan',              code:'+992' },
  { flag:'🇹🇿', name:'Tanzania',                code:'+255' },
  { flag:'🇹🇭', name:'Thailand',                code:'+66'  },
  { flag:'🇹🇱', name:'Timor-Leste',             code:'+670' },
  { flag:'🇹🇬', name:'Togo',                    code:'+228' },
  { flag:'🇹🇴', name:'Tonga',                   code:'+676' },
  { flag:'🇹🇹', name:'Trinidad & Tobago',       code:'+1868'},
  { flag:'🇹🇳', name:'Tunisia',                 code:'+216' },
  { flag:'🇹🇷', name:'Turkey',                  code:'+90'  },
  { flag:'🇹🇲', name:'Turkmenistan',            code:'+993' },
  { flag:'🇹🇻', name:'Tuvalu',                  code:'+688' },
  { flag:'🇺🇬', name:'Uganda',                  code:'+256' },
  { flag:'🇺🇦', name:'Ukraine',                 code:'+380' },
  { flag:'🇦🇪', name:'UAE',                     code:'+971' },
  { flag:'🇬🇧', name:'United Kingdom',          code:'+44'  },
  { flag:'🇺🇸', name:'USA',                     code:'+1'   },
  { flag:'🇺🇾', name:'Uruguay',                 code:'+598' },
  { flag:'🇺🇿', name:'Uzbekistan',              code:'+998' },
  { flag:'🇻🇺', name:'Vanuatu',                 code:'+678' },
  { flag:'🇻🇦', name:'Vatican City',            code:'+39'  },
  { flag:'🇻🇪', name:'Venezuela',               code:'+58'  },
  { flag:'🇻🇳', name:'Vietnam',                 code:'+84'  },
  { flag:'🇾🇪', name:'Yemen',                   code:'+967' },
  { flag:'🇿🇲', name:'Zambia',                  code:'+260' },
  { flag:'🇿🇼', name:'Zimbabwe',                code:'+263' },
];

export { DIAL_CODES, flagToISO };
export type { DialCode };

const defaultInputStyle: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', color: '#1A1830', background: '#fff', boxSizing: 'border-box' };

export default function PhoneInput({ value, onChange, dialCode, onDialChange, required, hasError, inputStyle }: { value: string; onChange: (v: string) => void; dialCode: string; onDialChange: (v: string) => void; required?: boolean; hasError?: boolean; inputStyle?: React.CSSProperties }) {
  const inp = inputStyle ?? defaultInputStyle;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = DIAL_CODES.find(d => d.code === dialCode) ?? DIAL_CODES[0];
  const filtered = query.trim() ? DIAL_CODES.filter(d => d.name.toLowerCase().includes(query.toLowerCase()) || d.code.includes(query)) : DIAL_CODES;
  const isPK = dialCode === '+92';
  const PLACEHOLDERS: Record<string, string> = {
    '+92': '0300 0000000', '+44': '7911 123456', '+1': '212 345 6789',
    '+61': '412 345 678', '+966': '50 123 4567', '+971': '50 123 4567',
    '+49': '151 1234567', '+353': '85 123 4567', '+64': '21 123 4567',
    '+47': '912 34 567', '+46': '712 345 678', '+45': '12 34 56 78',
    '+39': '312 3456789', '+34': '612 345678', '+33': '6 12 34 56 78',
    '+31': '6 1234 5678', '+30': '690 1234567', '+90': '512 345 6789',
    '+60': '12 3456 7890', '+974': '3312 3456', '+973': '3312 3456',
    '+965': '9999 1234', '+968': '9212 3456',
  };
  const placeholder = PLACEHOLDERS[dialCode] ?? 'Phone number';

  // Phone grouping patterns — same table as phoneDisplay() in lib/supabase.ts
  const PHONE_FORMATS: [string, ...number[]][] = [
    ['+353', 2, 3, 4], ['+966', 2, 3, 4], ['+971', 2, 3, 4],
    ['+968', 4, 4], ['+974', 4, 4], ['+973', 4, 4], ['+965', 4, 4],
    ['+92',  3, 7], ['+64',  2, 3, 4], ['+61',  3, 3, 3],
    ['+49',  3, 7], ['+47',  3, 2, 3], ['+46',  3, 3, 3],
    ['+45',  2, 2, 2, 2], ['+44', 4, 6], ['+39', 3, 7],
    ['+34',  3, 6], ['+33',  1, 2, 2, 2, 2], ['+31', 1, 4, 4],
    ['+30',  3, 7], ['+90',  3, 3, 4], ['+60',  2, 4, 4],
    ['+1',   3, 3, 4],
  ];

  const handlePhoneChange = (raw: string) => {
    // Strip everything except digits and spaces (allow user to backspace spaces)
    const digits = raw.replace(/\D/g, '');

    if (isPK) {
      const maxDigits = digits.startsWith('0') || digits.length === 0 ? 11 : 10;
      const capped = digits.slice(0, maxDigits);
      const breakAt = capped.startsWith('0') ? 4 : 3;
      const formatted = capped.length > breakAt ? `${capped.slice(0, breakAt)} ${capped.slice(breakAt)}` : capped;
      onChange(formatted);
      return;
    }

    // Find grouping for this dial code
    const fmt = PHONE_FORMATS.find(([code]) => code === dialCode);
    if (!fmt) { onChange(digits.slice(0, 15)); return; }

    const [, ...groups] = fmt;
    const maxDigits = groups.reduce((a, b) => a + b, 0);
    const capped = digits.slice(0, maxDigits);

    // Build grouped string — only add spaces up to where user has typed
    const parts: string[] = [];
    let pos = 0;
    for (const g of groups) {
      if (pos >= capped.length) break;
      parts.push(capped.slice(pos, pos + g));
      pos += g;
    }
    onChange(parts.join(' '));
  };

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button type="button" onClick={() => { setOpen(o => !o); setQuery(''); }}
          style={{ height: 44, padding: '0 10px', borderRadius: 11, border: '1.5px solid #E8E6F5', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#1A1830', whiteSpace: 'nowrap' }}>
          <img src={`https://flagcdn.com/20x15/${flagToISO(selected.flag)}.png`} width={20} height={15} alt="" style={{ borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontWeight: 700 }}>{selected.code}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1.5px solid #E8E6F5', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, width: 240, overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #E8E6F5', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search country..." style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1A1830', width: '100%', background: 'transparent' }} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {filtered.map(d => (
                <div key={d.name} onClick={() => { onDialChange(d.code); onChange(''); setOpen(false); setQuery(''); }}
                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: d.code === dialCode ? '#EEEDFE' : 'transparent', color: d.code === dialCode ? '#534AB7' : '#1A1830', fontWeight: d.code === dialCode ? 700 : 400 }}
                  onMouseEnter={e => { if (d.code !== dialCode) (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
                  onMouseLeave={e => { if (d.code !== dialCode) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <img src={`https://flagcdn.com/20x15/${flagToISO(d.flag)}.png`} width={20} height={15} alt="" style={{ borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ color: '#68629C', fontSize: 12 }}>{d.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <input value={value} onChange={e => handlePhoneChange(e.target.value)} style={{ ...inp, flex: 1, ...(hasError ? { border: '1.5px solid #DC2626', boxShadow: '0 0 0 2px rgba(220,38,38,0.12)' } : {}) }} placeholder={placeholder} type="tel" />
    </div>
  );
}
