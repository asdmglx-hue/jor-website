'use client';
import { useState, useEffect } from 'react';
import { supabase, isFeaturedSlotAvailable } from '@/lib/supabase';
import { CITY_GROUPS, COUNTRIES_FLAT } from '@/lib/constants';
// Moved server-side so a successful booking can instantly refresh cached
// listing pages instead of waiting on the 5-minute timer — see
// lib/actions/revalidate-write.ts for the full explanation.
import { bookFeaturedSlotAction } from '@/lib/actions/featured-actions';

// "city" can hold either a Pakistani city OR an overseas country name —
// the booking RPC just treats it as an opaque text match either way
// (featured_boosts.city has no constraint tying it to real Pakistani
// cities specifically), so no backend change was needed to allow this,
// only lib/supabase.ts's fetchProposalsForCategory/fetchProposals
// boost-matching needed to also recognize country-scoped boosts (see the
// comments there). "mode" is UI-only state — it decides which second
// select to show (Pakistan cities vs Overseas countries), matching the
// same two-step pattern as components/FilterBar.tsx's location filter.
type Slot = { mode: 'pakistan' | 'overseas' | ''; city: string; date: string; checking?: boolean }; // date is yyyy-mm-dd

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

// Matches the visual style already used for the Date input in this modal
// (not FilterBar's — that's tuned for the main browse toolbar, a
// different visual context than this card-style modal).
const selectStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 10,
  border: '1px solid #E8E6F5', background: '#F8F7FF', fontSize: 12.5, color: '#1A1830',
};

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
  const [slots, setSlots] = useState<Slot[]>([{ mode: '', city: '', date: '' }]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [maxPerCity, setMaxPerCity] = useState(5);

  useEffect(() => {
    if (!open) return;
    setSlots([{ mode: '', city: '', date: '' }]);
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

  const changeMode = (i: number, mode: Slot['mode']) => {
    setSlots(prev => prev.map((s, idx) => (idx === i ? { ...s, mode, city: '' } : s)));
    setErrorMsg(null);
  };

  const addSlot = () => setSlots(prev => (prev.length < maxSlots ? [...prev, { mode: '', city: '', date: '' }] : prev));
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
        const { data } = await bookFeaturedSlotAction({
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
          <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1830', marginBottom: 6 }}>Select Date & Location</div>
          <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.4, marginBottom: 18 }}>
            Pick where and when you want your profile featured. One credit is used per date & location.
          </div>

          {slots.map((slot, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Date {i + 1}</div>
                  <input
                    type="date"
                    min={todayStr()}
                    value={slot.date}
                    onChange={e => checkSlot(i, { date: e.target.value })}
                    style={selectStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Location {i + 1}</div>
                  <select value={slot.mode} onChange={e => changeMode(i, e.target.value as Slot['mode'])} style={selectStyle}>
                    <option value="">Pakistan or Overseas?</option>
                    <option value="pakistan">Pakistan</option>
                    <option value="overseas">Overseas</option>
                  </select>
                </div>
                {slots.length > 1 && (
                  <div onClick={() => removeSlot(i)} style={{ cursor: 'pointer', color: '#68629C', fontSize: 16, marginTop: 24, padding: '0 2px' }}>✕</div>
                )}
              </div>

              {slot.mode === 'pakistan' && (
                <select value={slot.city} onChange={e => checkSlot(i, { city: e.target.value })} style={{ ...selectStyle, marginTop: 8 }}>
                  <option value="">Select city</option>
                  {Object.entries(CITY_GROUPS).map(([province, cities]) => (
                    <optgroup key={province} label={province}>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
              {slot.mode === 'overseas' && (
                <select value={slot.city} onChange={e => checkSlot(i, { city: e.target.value })} style={{ ...selectStyle, marginTop: 8 }}>
                  <option value="">Select country</option>
                  {COUNTRIES_FLAT.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {slots.length < maxSlots ? (
              <div onClick={addSlot} style={{ cursor: 'pointer', color: '#534AB7', fontSize: 12.5, fontWeight: 700 }}>+ Add another date & location</div>
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
