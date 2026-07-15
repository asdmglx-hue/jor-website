'use client';
import React, { useEffect, useRef, useState } from 'react';
import { compressImage } from '@/lib/compressImage';
import { supabase } from '@/lib/supabase';
import { CITIES } from '@/lib/constants';

const MAX_FEATURED_SLOTS = 5;

type FeaturedSlot = { city: string; date: string }; // date is yyyy-mm-dd from <input type="date">

// ── Searchable city dropdown ────────────────────────────────────────────
// Flat, filtered-as-you-type list over the same CITIES used by the
// registration form — click-outside-to-close pattern matches the one
// already used elsewhere on this site (FilterBar's ProfessionSelect).
function CitySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? CITIES.filter(c => c.toLowerCase().includes(query.trim().toLowerCase()))
    : CITIES;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '10px 12px', borderRadius: 10, border: '1px solid #E8E6F5',
          background: '#F8F7FF', fontSize: 12.5, cursor: 'pointer',
          color: value ? '#1A1830' : '#B0ADCB', fontWeight: value ? 600 : 400,
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0ADCB" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        {value || 'Select city'}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 220, maxWidth: '80vw',
          background: '#fff', border: '1px solid #E8E6F5', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 300, overflow: 'hidden',
        }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search city..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: 'none', borderBottom: '1px solid #E8E6F5', fontSize: 12.5, outline: 'none' }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#B0ADCB' }}>No matching cities</div>
            )}
            {filtered.map(city => (
              <div key={city} onClick={() => { onChange(city); setOpen(false); setQuery(''); }}
                style={{ padding: '9px 12px', fontSize: 12.5, cursor: 'pointer',
                  color: value === city ? '#534AB7' : '#1A1830',
                  fontWeight: value === city ? 700 : 400,
                  background: value === city ? '#EEEDFE' : 'transparent' }}
                onMouseEnter={e => { if (value !== city) (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
                onMouseLeave={e => { if (value !== city) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                {city}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length > 12) return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function maxDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 180);
  return d.toISOString().slice(0, 10);
}

export default function PaymentProofModal({
  open, onClose, planName, isStandard, initialCnic, ftPriceInt, adminWa,
}: {
  open: boolean;
  onClose: () => void;
  planName: string;
  isStandard: boolean;
  initialCnic?: string;
  ftPriceInt: number;
  adminWa: string;
}) {
  const [cnic, setCnic] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [slots, setSlots] = useState<FeaturedSlot[]>([{ city: '', date: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset fresh every time the modal opens, same as the mobile sheet.
  useEffect(() => {
    if (!open) return;
    setCnic(formatCnic(initialCnic || ''));
    setReceipt(null);
    setReceiptPreview(null);
    setSlots([{ city: '', date: '' }]);
    setErrorMsg(null);
    setSubmitting(false);
  }, [open, initialCnic]);

  if (!open) return null;

  const updateSlot = (i: number, patch: Partial<FeaturedSlot>) => {
    setSlots(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setErrorMsg(null);
  };
  const removeSlot = (i: number) => setSlots(prev => prev.filter((_, idx) => idx !== i));
  const addSlot = () => setSlots(prev => (prev.length < MAX_FEATURED_SLOTS ? [...prev, { city: '', date: '' }] : prev));

  const handleSubmit = async () => {
    const digits = cnic.replace(/\D/g, '');
    if (digits.length !== 13) { setErrorMsg('Enter a complete 13-digit CNIC number.'); return; }
    if (!isStandard && !slots.every(s => s.city && s.date)) { setErrorMsg('Pick a date and city for every slot to continue.'); return; }
    if (!receipt) { setErrorMsg('Please attach your payment receipt.'); return; }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('cnic', digits);
      formData.append('receipt', receipt);
      const res = await fetch('/api/upload-payment-proof', { method: 'POST', body: formData });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setSubmitting(false);
        setErrorMsg(data.error || 'Failed to upload receipt. Please try again.');
        return;
      }
      const url = data.url;

      // Featured Post: record the requested date/city pairs so support can
      // see + approve them from the pending queue — same table + shape the
      // mobile app writes to, so both stay in sync.
      let selectionsText = '';
      if (!isStandard) {
        const selectionsJson = slots.map(s => ({ city: s.city, date: s.date }));
        const totalCredits = slots.length;
        const totalAmount = ftPriceInt * totalCredits;
        try {
          await supabase.from('pending_featured_requests').insert({
            cnic, selections: selectionsJson, total_credits: totalCredits, total_amount: totalAmount,
          });
        } catch (_) {
          // Non-blocking — the WhatsApp message below still carries the
          // full selection details for support to act on manually.
        }
        selectionsText = '\n\nFeatured Date & City selections:\n' +
          slots.map((s, i) => `${i + 1}. ${s.date} — ${s.city}`).join('\n');
      }

      const text = `Hello Admin,\n\nMy CNIC: ${cnic}\n\nI have completed the payment and attached the receipt. Kindly verify my payment.${selectionsText}\n\nPayment Receipt: ${url}`;
      window.open(`https://wa.me/${adminWa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');

      setSubmitting(false);
      onClose();
    } catch (_) {
      setSubmitting(false);
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1830', marginBottom: 6 }}>Upload Receipt</div>
        <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.4, marginBottom: 18 }}>
          Enter your CNIC and attach your payment receipt for verification.
        </div>

        {/* 1. CNIC Number */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>CNIC Number</div>
          <input
            value={cnic}
            onChange={e => setCnic(formatCnic(e.target.value))}
            placeholder="12345-1234567-1"
            maxLength={15}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #E8E6F5', fontSize: 13 }}
          />
        </div>

        {/* 2. Payment Receipt */}
        <div style={{ marginBottom: isStandard ? 6 : 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6B6893', marginBottom: 6 }}>Payment Receipt</div>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
              const raw = e.target.files?.[0];
              if (!raw) return;
              setCompressing(true);
              const f = await compressImage(raw);
              setReceipt(f); setReceiptPreview(URL.createObjectURL(f));
              setCompressing(false);
              setErrorMsg(null);
            }} />
            <div style={{ border: `2px dashed ${receipt ? '#534AB7' : '#E8E6F5'}`, borderRadius: 12, background: receipt ? '#EEEDFE' : '#FAFAFA', overflow: 'hidden', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {receiptPreview
                ? <img src={receiptPreview} alt="Payment receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: '#B0ADCB' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 6px' }}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><circle cx="7" cy="13" r="1"/></svg>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>Tap to upload receipt</div>
                  </div>
              }
              {receipt && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: '#534AB7', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: '#fff', fontWeight: 700 }}>✓ Selected</div>
              )}
              {compressing && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(83,74,183,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spin" style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} />
                </div>
              )}
            </div>
          </label>
        </div>

        {/* 3. Select Date & City (Featured Post only) */}
        {!isStandard && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6B6893', marginBottom: 10 }}>Select Date & City</div>
            {slots.map((slot, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#B0ADCB', marginBottom: 4 }}>Date {i + 1}</div>
                  <input
                    type="date"
                    value={slot.date}
                    min={todayStr()}
                    max={maxDateStr()}
                    onChange={e => updateSlot(i, { date: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 10, border: '1px solid #E8E6F5', fontSize: 12.5, background: '#F8F7FF' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#B0ADCB', marginBottom: 4 }}>City {i + 1}</div>
                  <CitySelect value={slot.city} onChange={v => updateSlot(i, { city: v })} />
                </div>
                {slots.length > 1 && (
                  <button type="button" onClick={() => removeSlot(i)} aria-label="Remove"
                    style={{ marginTop: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#B0ADCB', fontSize: 16, lineHeight: 1, padding: 4 }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {slots.length < MAX_FEATURED_SLOTS ? (
                <button type="button" onClick={addSlot}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#534AB7', fontSize: 12.5, fontWeight: 700, padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 15 }}>+</span> Add another date & city
                </button>
              ) : <span />}
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1830' }}>Total: Rs. {ftPriceInt * slots.length}</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 12, fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 12, border: 'none', background: submitting ? '#B0ADCB' : '#534AB7', color: '#fff', fontWeight: 700, fontSize: 14, cursor: submitting ? 'default' : 'pointer' }}>
            {submitting ? 'Sending…' : 'Send'}
          </button>
          <button onClick={onClose} disabled={submitting}
            style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid #E8E6F5', background: '#F8F7FF', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: submitting ? 'default' : 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
