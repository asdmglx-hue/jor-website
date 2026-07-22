'use client';
import { useState, useEffect, useRef } from 'react';

// Extracted from app/register/SubmitClient.tsx (was a local, unexported
// function there). Renders flat search results while typing, or grouped
// results (with group-name headers) when the search box is empty and more
// than one group was passed in — that grouping is what lets a single field
// offer, say, Pakistani cities AND overseas countries together without
// needing a separate toggle: pass a combined `groups` object (see
// lib/constants.ts's LOCATION_GROUPS) and the group headers do the rest.
export default function SearchableSelect({ value, onChange, groups, placeholder, hasError, buttonStyle }: { value: string; onChange: (v: string) => void; groups: Record<string, string[]>; placeholder: string; hasError?: boolean; buttonStyle?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allItems = Object.entries(groups).flatMap(([, items]) => items);
  const filtered = query.trim()
    ? allItems.filter(item => item.toLowerCase().includes(query.toLowerCase()))
    : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(o => !o); setQuery(''); }} style={{
        width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11, border: '1.5px solid #E8E6F5',
        fontSize: 14, outline: 'none', color: value ? '#1A1830' : '#9CA3AF', background: '#fff', cursor: 'pointer',
        textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        ...buttonStyle,
        ...(hasError ? { border: '1.5px solid #DC2626', boxShadow: '0 0 0 2px rgba(220,38,38,0.12)' } : {}),
      }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: '#fff', border: '1.5px solid #E8E6F5', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #E8E6F5', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1A1830', width: '100%', background: 'transparent' }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {value && (
              <div onClick={() => { onChange(''); setOpen(false); }} style={{ padding: '8px 12px', fontSize: 13, color: '#68629C', cursor: 'pointer' }}>
                Clear selection
              </div>
            )}
            {filtered
              ? filtered.map(item => (
                <div key={item} onClick={() => { onChange(item); setOpen(false); setQuery(''); }}
                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: item === value ? '#534AB7' : '#1A1830', fontWeight: item === value ? 700 : 400, background: item === value ? '#EEEDFE' : 'transparent' }}
                  onMouseEnter={e => { if (item !== value) (e.target as HTMLElement).style.background = '#F8F7FF'; }}
                  onMouseLeave={e => { if (item !== value) (e.target as HTMLElement).style.background = 'transparent'; }}>
                  {item}
                </div>
              ))
              : Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  {Object.keys(groups).length > 1 && <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 800, color: '#68629C', letterSpacing: 0.8, background: '#FAFAFA' }}>{group.toUpperCase()}</div>}
                  {items.map(item => (
                    <div key={`${group}-${item}`} onClick={() => { onChange(item); setOpen(false); setQuery(''); }}
                      style={{ padding: '8px 12px 8px 16px', fontSize: 13, cursor: 'pointer', color: item === value ? '#534AB7' : '#1A1830', fontWeight: item === value ? 700 : 400, background: item === value ? '#EEEDFE' : 'transparent' }}
                      onMouseEnter={e => { if (item !== value) (e.target as HTMLElement).style.background = '#F8F7FF'; }}
                      onMouseLeave={e => { if (item !== value) (e.target as HTMLElement).style.background = 'transparent'; }}>
                      {item}
                    </div>
                  ))}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
