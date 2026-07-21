'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase, isFeaturedSlotAvailable } from '@/lib/supabase';
import { CITIES } from '@/lib/constants';

type Slot = { city: string; date: string; checking?: boolean }; // date is yyyy-mm-dd

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Small searchable city dropdown — same pattern already used in
// PaymentProofModal's CitySelect, kept local here to avoid a cross-import.
function CitySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim() ? CITIES.filter(c => c.toLowerCase().includes(query.trim().toLowerCase())) : CITIES;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '10px 12px', borderRadius: 10, border: '1px solid #E8E6F5',
          background: '#F8F7FF', fontSize: 12.5, cursor: 'pointer',
          color: value ? '#1A1830' : '#68629C', fontWeight: value ? 600 : 400,
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {value || 'Select city'}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 220, maxWidth: '80vw',
          background: '#fff', border: '1px solid #E8E6F5', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 300, overflow: 'hidden',
        }}>
          <input
            autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search city..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: 'none', borderBottom: '1px solid #E8E6F5', fontSize: 12.5, outline: 'none' }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.map(c => (
              <div key={c} onClick={() => { onChange(c); setOpen(false); setQuery(''); }}
                style={{ padding: '9px 12px', fontSize: 12.5, cursor: 'pointer', color: '#1A1830', background: c === value ? '#F0EEFC' : 'transparent' }}>
                {c}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeaturedBookModal({
  open, onClose, cnic, maxSlots, onBooked, onResult,
}: {
  open: boolean;
  onClose: () => void;
  cnic: string;
  maxSlots: number;
  onBooked: () => void;
  onResult: (lines: string[], allBookedToday: boolean) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([{ city: '', date: '' }]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [maxPerCity, setMaxPerCity] = useState(5);

  useEffect(() => {
    if (!open) return;
    setSlots([{ city: '', date: '' }]);
    setErrorMsg(null);
    setSubmitting(false);
    supabase.from('app_settings').select('key, value').eq('key', 'max_featured_per_city').maybeSingle()
      .then(({ data }) => { if (data?.value) setMaxPerCity(Number(data.value) || 5); });
  }, [open]);

  if (!open) return null;

  const checkSlot = async (i: number, patch: Partial<Slot>) => {
    setSlots(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch, checking: true } : s)));
    const merged = { ...slots[i], ...patch };
    if (!merged.city || !merged.date) { setSlots(prev => prev.map((s, idx) => (idx === i ? { ...s, checking: false } : s))); return; }
    let available = true;
    try {
      available = await isFeaturedSlotAvailable(merged.city, merged.date, maxPerCity);
    } catch (_) {}
    setSlots(prev => prev.map((s, idx) => {
      if (idx !== i) return s;
      if (!available) return { ...s, date: '', checking: false };
      return { ...s, checking: false };
    }));
    if (!available) setErrorMsg(`No Featured slots left in ${merged.city} on that date. Please pick another date.`);
    else setErrorMsg(null);
  };

  const addSlot = () => setSlots(prev => (prev.length < maxSlots ? [...prev, { city: '', date: '' }] : prev));
  const removeSlot = (i: number) => setSlots(prev => prev.filter((_, idx) => idx !== i));

  const allFilled = slots.every(s => s.city && s.date && !s.checking);
  const allToday = allFilled && slots.every(s => s.date === todayStr());

  const handleConfirm = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    const bookingLines: string[] = [];
    let allBookedToday = true;
    for (const slot of slots) {
      try {
        const { data } = await supabase.rpc('book_featured_slot_with_credit', {
          p_cnic: cnic, p_city: slot.city, p_date: slot.date,
        });
        if (data?.success) {
          const shifted = data.shifted === true;
          const bookedDate = data.booked_date as string | undefined;
          const display = bookedDate ? fmtDate(bookedDate) : '—';
          bookingLines.push(shifted
            ? `Your booking in ${slot.city} has been moved to ${display} because your requested date was fully booked.`
            : `${slot.city} — ${display}`);
          if (!bookedDate || !isSameDay(new Date(bookedDate), new Date())) allBookedToday = false;
        } else {
          bookingLines.push(`${slot.city} — could not be booked (${data?.error ?? 'please contact support'}). Your credit has not been lost.`);
          allBookedToday = false;
        }
      } catch (_) {
        bookingLines.push(`${slot.city} — could not be booked right now. Please contact support — your credit is safe.`);
        allBookedToday = false;
      }
    }
    setSubmitting(false);
    onBooked();
    onClose();
    onResult(bookingLines, allBookedToday);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 20, maxWidth: 440, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1830', marginBottom: 6 }}>Select Date & City</div>
          <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.4, marginBottom: 18 }}>
            Pick where and when you want your profile featured. One credit is used per date & city.
          </div>

          {slots.map((slot, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Date {i + 1}</div>
                <input
                  type="date"
                  min={todayStr()}
                  value={slot.date}
                  onChange={e => checkSlot(i, { date: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 10, border: '1px solid #E8E6F5', background: '#F8F7FF', fontSize: 12.5 }}
                />
              </div>
              <div style={{ flex: 3 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>City {i + 1}</div>
                <CitySelect value={slot.city} onChange={c => checkSlot(i, { city: c })} />
              </div>
              {slots.length > 1 && (
                <div onClick={() => removeSlot(i)} style={{ cursor: 'pointer', color: '#68629C', fontSize: 16, marginTop: 24, padding: '0 2px' }}>✕</div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {slots.length < maxSlots ? (
              <div onClick={addSlot} style={{ cursor: 'pointer', color: '#534AB7', fontSize: 12.5, fontWeight: 700 }}>+ Add another date & city</div>
            ) : <span />}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1830' }}>{slots.length} credit{slots.length === 1 ? '' : 's'}</div>
          </div>

          {errorMsg && <div style={{ marginTop: 10, fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>{errorMsg}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} disabled={submitting} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!allFilled || submitting}
              style={{
                flex: 2, padding: '13px', borderRadius: 12, border: 'none',
                background: (!allFilled || submitting) ? '#E8620A59' : '#E8620A',
                color: '#fff', fontWeight: 800, cursor: (!allFilled || submitting) ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'Booking…' : (allToday ? 'Featured Now' : 'Schedule Now')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
