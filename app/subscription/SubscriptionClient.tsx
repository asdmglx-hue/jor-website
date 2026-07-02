'use client';
import React, { useState, useEffect } from 'react';
import { getSession, saveSession } from '@/lib/auth';
import { redeemCode, isSubscriptionActive, Proposal, supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ADMIN_WHATSAPP = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || '923000000000';
const STD_PRICE = process.env.NEXT_PUBLIC_STD_PRICE || '1,000';
const STD_MONTHS = process.env.NEXT_PUBLIC_STD_MONTHS || '3 Months';
const FT_PRICE = process.env.NEXT_PUBLIC_FT_PRICE || '200';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  'Rishta Profile': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  'Featured Post': <span style={{ fontSize: 18, lineHeight: 1 }}>⚡</span>,
};

// ── PlanCard (no state access — pure display) ─────────────────────────────
function PlanCard({ plan, selected, onSelect }: {
  plan: { name: string; price: string; duration: string; tagline: string; features: string[]; note?: string; color: string; bg: string; popular?: boolean };
  selected: boolean; onSelect: () => void;
}) {
  return (
    <div onClick={onSelect} style={{
      border: `2px solid ${selected ? plan.color : '#E8E6F5'}`,
      borderRadius: 18, padding: '20px', marginBottom: 14, cursor: 'pointer',
      background: selected ? plan.bg : '#fff',
      transition: 'all 0.2s', position: 'relative',
    }}>
      {plan.popular && (
        <div style={{ position: 'absolute', top: -10, right: 16, background: plan.color, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5 }}>
          MOST POPULAR
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: selected ? plan.color : '#1A1830', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: plan.color }}>{PLAN_ICONS[plan.name]}</span>
            {plan.name}
          </div>
          <div style={{ fontSize: 12, color: '#6B6893', marginTop: 2 }}>{plan.tagline}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: plan.color }}>Rs. {plan.price}</div>
          <div style={{ fontSize: 11, color: '#6B6893' }}>{plan.duration}</div>
        </div>
      </div>
      <div style={{ height: 1, background: '#E8E6F5', margin: '10px 0' }} />
      {plan.features.map(f => (
        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#1A1830', marginBottom: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
          {f}
        </div>
      ))}
      {plan.note && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#6B6893', marginTop: 8, fontStyle: 'italic' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ADCB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {plan.note}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${selected ? plan.color : '#E8E6F5'}`, background: selected ? plan.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {selected && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: selected ? plan.color : '#6B6893' }}>{selected ? 'Selected' : 'Select this plan'}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SubscriptionClient() {
  const router = useRouter();
  const [user, setUser] = useState<Proposal | null | undefined>(undefined);
  const [selected, setSelected] = useState(-1);
  const [showPayModal, setShowPayModal] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setUser(getSession() ?? null);
    const params = new URLSearchParams(window.location.search);
    if (params.get('plan') === 'featured') setSelected(1);
    supabase.from('app_settings').select('key, value').then(({ data }) => {
      if (data) {
        const s: Record<string, string> = {};
        (data as { key: string; value: string }[]).forEach(r => { s[r.key] = r.value; });
        setSettings(s);
      }
    }).catch(() => {});
  }, []);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const plans = [
    {
      name: 'Rishta Profile', price: STD_PRICE, duration: STD_MONTHS,
      tagline: 'See all contact numbers', color: '#534AB7', bg: '#EEEDFE', popular: true,
      features: ['Publish your profile', 'Unlimited Local Proposals', 'Unlimited Overseas Proposals', 'View Contact numbers and Photos', 'Use Advanced Search Filters', `Validity for ${STD_MONTHS}`, '24 hours support'],
      note: undefined,
    },
    {
      name: 'Featured Post', price: FT_PRICE, duration: '24 hours',
      tagline: 'Stand out. Get noticed.', color: '#E8620A', bg: '#FEEDE3', popular: false,
      features: ['Schedule Your Featured Date', 'Choose Your Featured City', 'Up to 5× more visibility', '24 hours validity'],
      note: 'Requires Rishta Profile subscription',
    },
  ];

  const adminWa = settings['whatsapp_number'] || ADMIN_WHATSAPP;

  const whatsappMsg = (planName: string) =>
    user
      ? `https://wa.me/${adminWa}?text=${encodeURIComponent(`Hi, I want to subscribe to the ${planName} plan on Jor.\n\nMy Name: ${user.name}\nCNIC: ${user.cnic || 'N/A'}\nProposal #: ${user.proposal_number}`)}`
      : `https://wa.me/${adminWa}?text=${encodeURIComponent(`Hi, I want to subscribe to the ${planName} plan on Jor.`)}`;

  if (user === undefined) return <div style={{ textAlign: 'center', padding: 60 }}>Loading...</div>;

  const isActive = user ? isSubscriptionActive(user) : false;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
      <Link href="/my-proposal" style={{ fontSize: 13, color: '#534AB7', fontWeight: 700, textDecoration: 'none' }}>← Back to My Profile</Link>

      <div style={{ textAlign: 'center', margin: '24px 0 32px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Choose a Plan</h1>
        <p style={{ color: '#6B6893', fontSize: 14 }}>Simple pricing for full access</p>
      </div>

      {/* Plans */}
      <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        {plans.map((plan, i) => (
          <PlanCard key={plan.name} plan={plan} selected={selected === i} onSelect={() => setSelected(selected === i ? -1 : i)} />
        ))}
      </div>

      {/* CTA Button */}
      {selected >= 0 && (
        isActive && user && selected === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '15px', borderRadius: 14, background: '#E5E4F0',
            fontWeight: 800, fontSize: 15, marginBottom: 24, color: '#9895C0',
            cursor: 'default', border: '2px solid #D4D2E8',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9895C0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Active · Expires {user.subscription_expiry ? new Date(user.subscription_expiry).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </div>
        ) : (
          <button onClick={() => setShowPayModal(true)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '15px', borderRadius: 14, background: '#534AB7', color: '#fff',
            fontWeight: 800, fontSize: 16, border: 'none', cursor: 'pointer', width: '100%',
            marginBottom: 24, boxShadow: '0 4px 16px rgba(83,74,183,0.3)',
          }}>
            Continue with {plans[selected].name} – Rs. {plans[selected].price}
          </button>
        )
      )}

      {/* Payment Modal */}
      {showPayModal && selected >= 0 && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPayModal(false); }}
        >
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1830', marginBottom: 4 }}>Payment Instructions</div>
            <div style={{ fontSize: 13, color: '#6B6893', marginBottom: 16 }}>
              Plan: <b>{plans[selected].name}</b> · Rs. {plans[selected].price}
            </div>
            <div style={{ height: 1, background: '#E8E6F5', marginBottom: 16 }} />

            {(settings['payment_mode'] ?? 'auto') === 'manual' ? (
              <>
                {settings['account_number'] && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1830' }}>Wallet Transfer</div>
                      <img src="/wallet-logos.png" alt="Wallet" style={{ height: 24, objectFit: 'contain' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F8F7FF', borderRadius: 10, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#6B6893', fontWeight: 600 }}>{settings['account_title'] || 'Account'}</div>
                        <div style={{ fontSize: 13, color: '#1A1830', fontWeight: 700 }}>{settings['account_number']}</div>
                      </div>
                      <button onClick={() => copyText(settings['account_number']!, 'wallet')}
                        style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #E8E6F5', background: copied === 'wallet' ? '#534AB7' : '#fff', color: copied === 'wallet' ? '#fff' : '#534AB7', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {copied === 'wallet' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </>
                )}

                {settings['bank_name'] && settings['bank_account'] && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1830' }}>Bank Transfer</div>
                      <img src="/bank-logos.png" alt="Bank" style={{ height: 24, objectFit: 'contain' }} />
                    </div>
                    {([
                      { label: 'Bank', value: settings['bank_name'], key: 'bank' },
                      ...(settings['bank_holder'] ? [{ label: 'Account Title', value: settings['bank_holder'], key: 'holder' }] : []),
                      { label: 'IBAN', value: settings['bank_account'], key: 'iban' },
                      ...(settings['bank_swift'] ? [{ label: 'Swift', value: settings['bank_swift'], key: 'swift' }] : []),
                    ] as { label: string; value: string; key: string }[]).map(row => (
                      <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F8F7FF', borderRadius: 10, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#6B6893', fontWeight: 600 }}>{row.label}</div>
                          <div style={{ fontSize: 13, color: '#1A1830', fontWeight: 700 }}>{row.value}</div>
                        </div>
                        <button onClick={() => copyText(row.value, row.key)}
                          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #E8E6F5', background: copied === row.key ? '#534AB7' : '#fff', color: copied === row.key ? '#fff' : '#534AB7', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          {copied === row.key ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </>
                )}

                <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.6, margin: '16px 0' }}>
                  {settings['payment_instruction'] || 'Send your payment proof to admin on WhatsApp. Your subscription will be activated within 24 hours.'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.6, marginBottom: 16 }}>
                Contact admin on WhatsApp to complete your payment.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <a href={whatsappMsg(plans[selected].name)} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px', borderRadius: 12, background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                WhatsApp Admin
              </a>
              <button onClick={() => setShowPayModal(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid #E8E6F5', background: '#F8F7FF', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
