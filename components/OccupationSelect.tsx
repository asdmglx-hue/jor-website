'use client';
import { useState, useEffect, useRef } from 'react';

// OccupationSelect — website equivalent of the Flutter OccupationPicker.
//
// UX matches the Flutter app exactly:
//  • Single search box across ALL job titles (no pre-selecting a category first)
//  • "Other (my job isn't listed)" pinned at the top
//  • Selecting any result returns both the profession AND the category together
//  • When "Other" is selected, a free-text box + real category dropdown appear below
//
// Used by: SubmitClient.tsx (registration) and MyProposalClient.tsx (edit profile)

interface OccupationSelectProps {
  professionValue: string;        // current profession value (e.g. "Doctor" or "Other")
  categoryValue: string;          // current category value (e.g. "Healthcare")
  customValue?: string;           // free-text when Other is selected
  groups: Record<string, string[]>; // category → professions map from DB
  onSelect: (profession: string, category: string) => void;
  onCustomChange?: (v: string) => void;
  onCategoryChange?: (v: string) => void;
  hasError?: boolean;
  customHasError?: boolean;
  categoryHasError?: boolean;
  placeholder?: string;
}

export default function OccupationSelect({
  professionValue,
  categoryValue,
  customValue = '',
  groups,
  onSelect,
  onCustomChange,
  onCategoryChange,
  hasError,
  customHasError,
  categoryHasError,
  placeholder = 'Search or select occupation',
}: OccupationSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Build display text same as Flutter app
  const displayText = !professionValue
    ? ''
    : professionValue === 'Other'
      ? (categoryValue ? `Other — ${categoryValue}` : 'Other — select a category below')
      : `${professionValue} — ${categoryValue}`;

  // Filter all professions across all groups (excluding 'Other' group)
  const filteredGroups: Record<string, string[]> = {};
  const q = query.trim().toLowerCase();
  for (const [cat, profs] of Object.entries(groups)) {
    if (cat === 'Other') continue;
    const matches = q ? profs.filter(p => p.toLowerCase().includes(q)) : profs;
    if (matches.length > 0) filteredGroups[cat] = matches;
  }

  const realCategoryList = Object.keys(groups).filter(k => k !== 'Other');

  // Styles
  const purple = '#534AB7';
  const purpleLight = '#EEEDFE';
  const border = hasError ? '#DC2626' : '#E8E6F5';
  const borderShadow = hasError ? '0 0 0 2px rgba(220,38,38,0.12)' : undefined;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 13px',
          borderRadius: 11, border: `1.5px solid ${border}`,
          boxShadow: borderShadow, fontSize: 14, outline: 'none',
          color: professionValue ? '#1A1830' : '#9CA3AF',
          background: '#fff', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}
      >
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayText || placeholder}
        </span>
        {/* Search icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400,
          background: '#fff', border: '1.5px solid #E8E6F5', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)', marginTop: 4, overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid #E8E6F5',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search e.g. Nurse, Teacher, Driver..."
              style={{
                border: 'none', outline: 'none', fontSize: 13.5,
                color: '#1A1830', width: '100%', background: 'transparent',
              }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {/* Pinned "Other" tile */}
            {!query && (
              <div
                onClick={() => { onSelect('Other', categoryValue || ''); setOpen(false); setQuery(''); }}
                style={{
                  padding: '10px 14px', fontSize: 13.5, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: professionValue === 'Other' ? purpleLight : 'transparent',
                  color: professionValue === 'Other' ? purple : '#6B6893',
                  fontWeight: professionValue === 'Other' ? 700 : 500,
                  borderBottom: '1px solid #F0F0F8',
                }}
                onMouseEnter={e => { if (professionValue !== 'Other') (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
                onMouseLeave={e => { if (professionValue !== 'Other') (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span>Other (my job isn&apos;t listed)</span>
                {professionValue === 'Other' && (
                  <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={purple} strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            )}

            {/* Grouped results */}
            {Object.keys(filteredGroups).length === 0 && query ? (
              <div style={{ padding: '16px 14px', fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
                No results found
              </div>
            ) : (
              Object.entries(filteredGroups).map(([cat, profs]) => (
                <div key={cat}>
                  <div style={{
                    padding: '8px 14px 3px', fontSize: 10, fontWeight: 800,
                    color: purple, letterSpacing: 0.8, background: '#FAFAFE',
                  }}>
                    {cat.toUpperCase()}
                  </div>
                  {profs.map(prof => {
                    const selected = professionValue === prof && categoryValue === cat;
                    return (
                      <div
                        key={`${cat}-${prof}`}
                        onClick={() => { onSelect(prof, cat); setOpen(false); setQuery(''); }}
                        style={{
                          padding: '9px 14px 9px 20px', fontSize: 13.5, cursor: 'pointer',
                          color: selected ? purple : '#1A1830',
                          fontWeight: selected ? 700 : 400,
                          background: selected ? purpleLight : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                        onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
                        onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        {prof}
                        {selected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={purple} strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Specify Occupation + Category — shown when Other is selected.
          Styled to match the SubSection component used throughout the
          registration form: indented with left margin, light purple bg. */}
      {professionValue === 'Other' && (
        <div style={{
          marginTop: 8, marginLeft: 16, marginBottom: 4,
          padding: 12, background: '#F8F7FF',
          borderRadius: 12, border: '1px solid #E8E6F5',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#6B6893', display: 'block', marginBottom: 4 }}>
              Specify Occupation
            </label>
            <input
              value={customValue}
              onChange={e => onCustomChange?.(e.target.value)}
              placeholder="e.g. Calligrapher, Gemologist"
              maxLength={30}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 13px',
                borderRadius: 11, fontSize: 14,
                border: `1.5px solid ${customHasError ? '#DC2626' : '#E8E6F5'}`,
                boxShadow: customHasError ? '0 0 0 2px rgba(220,38,38,0.12)' : undefined,
                outline: 'none', color: '#1A1830', background: '#fff',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#6B6893', display: 'block', marginBottom: 4 }}>
              Occupation Category
            </label>
            <select
              value={categoryValue || ''}
              onChange={e => onCategoryChange?.(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 13px',
                borderRadius: 11, fontSize: 14,
                border: `1.5px solid ${categoryHasError ? '#DC2626' : '#E8E6F5'}`,
                boxShadow: categoryHasError ? '0 0 0 2px rgba(220,38,38,0.12)' : undefined,
                outline: 'none', color: categoryValue ? '#1A1830' : '#9CA3AF',
                background: '#fff', cursor: 'pointer',
              }}
            >
              <option value="">Select category</option>
              {realCategoryList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
