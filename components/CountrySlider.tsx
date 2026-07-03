'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const ISO: Record<string, string> = {
  'UAE': 'ae', 'United Arab Emirates': 'ae', 'Afghanistan': 'af', 'Antigua & Barbuda': 'ag',
  'Albania': 'al', 'Armenia': 'am', 'Angola': 'ao', 'Argentina': 'ar', 'Austria': 'at',
  'Australia': 'au', 'Azerbaijan': 'az', 'Bosnia & Herzegovina': 'ba', 'Barbados': 'bb',
  'Bangladesh': 'bd', 'Belgium': 'be', 'Burkina Faso': 'bf', 'Bulgaria': 'bg',
  'Bahrain': 'bh', 'Burundi': 'bi', 'Benin': 'bj', 'Brunei': 'bn', 'Bolivia': 'bo',
  'Brazil': 'br', 'Bahamas': 'bs', 'Bhutan': 'bt', 'Botswana': 'bw', 'Belarus': 'by',
  'Belize': 'bz', 'Canada': 'ca', 'Congo (DR)': 'cd', 'Central African Republic': 'cf',
  'Congo': 'cg', 'Switzerland': 'ch', 'Chile': 'cl', 'Cameroon': 'cm', 'China': 'cn',
  'Colombia': 'co', 'Costa Rica': 'cr', 'Cuba': 'cu', 'Cabo Verde': 'cv', 'Cyprus': 'cy',
  'Czech Republic': 'cz', 'Germany': 'de', 'Djibouti': 'dj', 'Denmark': 'dk',
  'Dominica': 'dm', 'Dominican Republic': 'do', 'Algeria': 'dz', 'Ecuador': 'ec',
  'Estonia': 'ee', 'Egypt': 'eg', 'Eritrea': 'er', 'Spain': 'es', 'Ethiopia': 'et',
  'Finland': 'fi', 'Fiji': 'fj', 'Micronesia': 'fm', 'France': 'fr', 'Gabon': 'ga',
  'United Kingdom': 'gb', 'Grenada': 'gd', 'Georgia': 'ge', 'Ghana': 'gh', 'Gambia': 'gm',
  'Guinea': 'gn', 'Equatorial Guinea': 'gq', 'Greece': 'gr', 'Guatemala': 'gt',
  'Guinea-Bissau': 'gw', 'Guyana': 'gy', 'Honduras': 'hn', 'Croatia': 'hr', 'Haiti': 'ht',
  'Hungary': 'hu', 'Indonesia': 'id', 'Ireland': 'ie', 'Israel': 'il', 'India': 'in',
  'Iraq': 'iq', 'Iran': 'ir', 'Iceland': 'is', 'Italy': 'it', 'Jamaica': 'jm',
  'Jordan': 'jo', 'Japan': 'jp', 'Kenya': 'ke', 'Kyrgyzstan': 'kg', 'Cambodia': 'kh',
  'Kiribati': 'ki', 'Comoros': 'km', 'Kuwait': 'kw', 'Kazakhstan': 'kz', 'Laos': 'la',
  'Lebanon': 'lb', 'Liechtenstein': 'li', 'Sri Lanka': 'lk', 'Liberia': 'lr',
  'Lesotho': 'ls', 'Lithuania': 'lt', 'Luxembourg': 'lu', 'Latvia': 'lv', 'Libya': 'ly',
  'Morocco': 'ma', 'Monaco': 'mc', 'Moldova': 'md', 'Montenegro': 'me', 'Madagascar': 'mg',
  'Marshall Islands': 'mh', 'North Macedonia': 'mk', 'Mali': 'ml', 'Myanmar': 'mm',
  'Mongolia': 'mn', 'Mauritania': 'mr', 'Malta': 'mt', 'Mauritius': 'mu', 'Maldives': 'mv',
  'Malawi': 'mw', 'Mexico': 'mx', 'Malaysia': 'my', 'Mozambique': 'mz', 'Namibia': 'na',
  'Niger': 'ne', 'Nigeria': 'ng', 'Nicaragua': 'ni', 'Netherlands': 'nl', 'Norway': 'no',
  'Nepal': 'np', 'Nauru': 'nr', 'New Zealand': 'nz', 'Oman': 'om', 'Panama': 'pa',
  'Peru': 'pe', 'Papua New Guinea': 'pg', 'Philippines': 'ph', 'Poland': 'pl',
  'Palestine': 'ps', 'Portugal': 'pt', 'Palau': 'pw', 'Paraguay': 'py', 'Qatar': 'qa',
  'Romania': 'ro', 'Serbia': 'rs', 'Russia': 'ru', 'Rwanda': 'rw', 'Saudi Arabia': 'sa',
  'Solomon Islands': 'sb', 'Seychelles': 'sc', 'Sudan': 'sd', 'Sweden': 'se',
  'Singapore': 'sg', 'Slovenia': 'si', 'Slovakia': 'sk', 'Sierra Leone': 'sl',
  'San Marino': 'sm', 'Senegal': 'sn', 'Somalia': 'so', 'Suriname': 'sr',
  'South Sudan': 'ss', 'Syria': 'sy', 'Eswatini': 'sz', 'Chad': 'td', 'Togo': 'tg',
  'Thailand': 'th', 'Tajikistan': 'tj', 'Timor-Leste': 'tl', 'Turkmenistan': 'tm',
  'Tunisia': 'tn', 'Tonga': 'to', 'Turkey': 'tr', 'Trinidad & Tobago': 'tt',
  'Tuvalu': 'tv', 'Taiwan': 'tw', 'Tanzania': 'tz', 'Ukraine': 'ua', 'Uganda': 'ug',
  'USA': 'us', 'United States': 'us', 'Uruguay': 'uy', 'Uzbekistan': 'uz',
  'Vatican City': 'va', 'Saint Vincent': 'vc', 'Venezuela': 've', 'Vietnam': 'vn',
  'Vanuatu': 'vu', 'Samoa': 'ws', 'Kosovo': 'xk', 'Yemen': 'ye', 'South Africa': 'za',
  'Zambia': 'zm', 'Zimbabwe': 'zw', 'Andorra': 'ad', 'Pakistan': 'pk',
  'South Korea': 'kr', 'North Korea': 'kp',
};

export default function CountrySlider({ countries }: { countries: { country: string; count: number }[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  // Drag state — same idea as CitySlider, but this track's position is
  // negative-ranging (see the animate loop below), so the wrap-around math
  // during a drag needs to match that convention, not CitySlider's.
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const hasDraggedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf: number;
    const speed = 0.4;
    // Start at -half so first items are visible entering from left
    posRef.current = -(track.scrollWidth / 2);

    const animate = () => {
      if (!pausedRef.current) {
        posRef.current += speed;
        const half = track.scrollWidth / 2;
        if (posRef.current >= 0) posRef.current = posRef.current - half;
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [countries]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartPosRef.current = posRef.current;
    setPaused(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current; // this track moves the opposite way, so delta direction flips vs CitySlider
    if (Math.abs(deltaX) > 3) hasDraggedRef.current = true;
    const half = trackRef.current.scrollWidth / 2;
    // Keep position in (-half, 0], matching this track's own convention.
    let next = (dragStartPosRef.current + deltaX) % half;
    if (next > 0) next -= half;
    posRef.current = next;
    trackRef.current.style.transform = `translateX(${next}px)`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    setPaused(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDraggedRef.current = false;
    }
  };

  // Repeat until at least 20 items
  const base = countries.length === 0 ? [] : countries;
  let repeated = [...base];
  while (repeated.length < 20) repeated = [...repeated, ...base];
  const loopSet = [...repeated, ...repeated];

  return (
    <div
      style={{ overflow: 'hidden', position: 'relative', cursor: isDraggingRef.current ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { if (!isDraggingRef.current) setPaused(false); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, #F5F4FF, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, #F5F4FF, transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div ref={trackRef} style={{ display: 'flex', gap: 10, width: 'max-content', padding: '4px 0' }}>
        {loopSet.map((item, i) => {
          const code = ISO[item.country];
          return (
            <Link
              key={i}
              href={`/proposals?country=${encodeURIComponent(item.country)}`}
              draggable={false}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 12,
                background: '#fff', border: '1.5px solid #E8E6F5',
                color: '#534AB7', fontWeight: 700, fontSize: 14,
                textDecoration: 'none', whiteSpace: 'nowrap',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                userSelect: 'none',
              }}
            >
              {code && (
                <img
                  src={`https://flagcdn.com/20x15/${code}.png`}
                  width="20" height="15"
                  alt={item.country}
                  draggable={false}
                  style={{ borderRadius: 2, objectFit: 'cover' }}
                />
              )}
              {item.country}
              <span style={{ fontSize: 11, fontWeight: 600, color: '#B0ADCB' }}>{item.count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
