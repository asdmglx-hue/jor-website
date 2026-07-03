import { supabase, fetchAllRows, CARD_COLS } from '@/lib/supabase';
import { CITIES as VALID_CITY_NAMES, normalizeCountry } from '@/lib/constants';
import Link from 'next/link';
import Image from 'next/image';
import ProposalCard from '@/components/ProposalCard';
import CitySlider from '@/components/CitySlider';
import CountrySlider from '@/components/CountrySlider';
import PostRishtaButton from '@/components/PostRishtaButton';
import AnimatedCounter from '@/components/AnimatedCounter';
import type { Proposal } from '@/lib/supabase';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Jor – Find Your Perfect Rishta in Pakistan | Trusted Matrimonial Platform",
  description: "Browse thousands of verified rishta proposals across Pakistan and overseas. Filter by city, caste, sect, profession and more. Free to join, no middlemen.",
};

// The known-good set of real Pakistani cities — same list the SEO city
// pages already use. Anything outside this (e.g. "Sydney", "Istanbul")
// is a data-entry mistake — someone's overseas city ended up in the
// "city" field instead of the separate country field the site already
// has a dedicated Overseas section for. Filtering here doesn't touch the
// underlying data, just keeps the homepage slider showing only genuine
// Pakistani cities.
const VALID_CITIES = new Set(VALID_CITY_NAMES.filter(c => c !== 'Other'));

async function getStats() {
  const { count: total } = await supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'active');
  const { count: male } = await supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('gender', 'Male');
  const { count: female } = await supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('gender', 'Female');
  return { total: total || 0, male: male || 0, female: female || 0 };
}

// fetchAllRows fetches every matching row in batches — without it, this
// silently caps at Supabase's default 1000-row limit once the site has
// more active profiles than that, quietly undercounting cities without
// any error (this is exactly what caused ~171 profiles to go missing from
// generateStaticParams elsewhere on the site).
async function getCities(): Promise<{ city: string; count: number }[]> {
  const data = await fetchAllRows<{ city: string }>((from, to) =>
    supabase.from('proposals').select('city').eq('status', 'active').range(from, to)
  );
  const counts: Record<string, number> = {};
  for (const row of data) {
    if (row.city && VALID_CITIES.has(row.city)) counts[row.city] = (counts[row.city] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}

async function getCountries(): Promise<{ country: string; count: number }[]> {
  const data = await fetchAllRows<{ country: string | null }>((from, to) =>
    supabase
      .from('proposals')
      .select('country')
      .eq('status', 'active')
      .not('country', 'is', null)
      .neq('country', '')
      .neq('country', 'Pakistan')
      .neq('country', 'Other')
      .range(from, to)
  );
  const counts: Record<string, number> = {};
  for (const row of data) {
    if (row.country) {
      const c = normalizeCountry(row.country);
      counts[c] = (counts[c] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

async function getFeatured(): Promise<Proposal[]> {
  // Get proposals boosted via the is_boosted flag or subscription tier
  const { data: flagged } = await supabase
    .from('proposals')
    .select(CARD_COLS)
    .eq('status', 'active')
    .or('is_boosted.eq.true,subscription_tier.eq.featured')
    .order('posted_at', { ascending: false })
    .limit(6);

  // Also pull active boosts from featured_boosts table (used by mobile app)
  // Include boosts where: not ended AND (started OR scheduled_date has passed)
  const now = new Date().toISOString();
  const { data: boosts } = await supabase
    .from('featured_boosts')
    .select('user_id')
    .is('end_notified_at', null)
    .lte('scheduled_date', now);

  const boostIds = (boosts || []).map((b: { user_id: string }) => b.user_id);
  if (boostIds.length > 0) {
    const { data: boostedProposals } = await supabase
      .from('proposals')
      .select(CARD_COLS)
      .eq('status', 'active')
      .in('id', boostIds);
    const existing = new Set((flagged || []).map((p: { id: string }) => p.id));
    const extra = (boostedProposals || []).filter((p: { id: string }) => !existing.has(p.id));
    return [...(flagged || []), ...extra].slice(0, 6) as Proposal[];
  }

  return (flagged || []) as Proposal[];
}

async function getRecent(): Promise<Proposal[]> {
  const { data } = await supabase
    .from('proposals')
    .select(CARD_COLS)
    .eq('status', 'active')
    .order('posted_at', { ascending: false })
    .limit(9);
  return (data || []) as Proposal[];
}

const CITIES = ['Lahore','Karachi','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar','Quetta'];

export default async function HomePage() {
  const [stats, recent, cities, countries] = await Promise.all([getStats(), getRecent(), getCities(), getCountries()]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Jor',
        url: 'https://joronline.com',
        description: "Pakistan's trusted matrimonial platform connecting families for marriage across Pakistan and overseas.",
        areaServed: 'PK',
      },
      {
        '@type': 'WebSite',
        name: 'Jor – Matrimonial Platform',
        url: 'https://joronline.com',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://joronline.com/proposals?search={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <div>
      {/* Structured data: tells search engines exactly what this site is
          and that it has a search feature — a small addition that can
          unlock richer result displays, not just a plain blue link. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #534AB7 0%, #3D35A0 50%, #0F6E56 100%)',
        padding: '64px 20px 80px', textAlign: 'center', color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Wedding photo as background at low opacity */}
        <Image
          src="/hero-wedding.jpg"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          style={{
            objectFit: 'cover', objectPosition: 'center',
            opacity: 0.13, mixBlendMode: 'luminosity', pointerEvents: 'none',
          }}
        />
        {/* Gradient overlay to keep text crisp */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'radial-gradient(circle at 20% 80%, #fff 0%, transparent 50%), radial-gradient(circle at 80% 20%, #fff 0%, transparent 50%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
          <Image src="/hero-couple.png" alt="" aria-hidden="true" width={120} height={120} priority style={{ height: 120, width: 'auto', display: 'block', margin: '0 auto 8px' }} />
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15 }}>
            <span style={{ color: '#ffffff' }}>Find Your Perfect</span><br />
            <span style={{ color: '#D4D1F7' }}>Rishta in Pakistan</span>
          </h1>
          <p style={{ fontSize: 17, opacity: 0.88, margin: '0 0 32px', lineHeight: 1.6 }}>
            Browse {stats.total.toLocaleString()}+ verified proposals across Pakistan.<br className="hero-br" />Filter by city, caste, profession and more.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/proposals" style={{
              padding: '14px 32px', borderRadius: 14, background: '#fff', color: '#534AB7',
              fontWeight: 800, fontSize: 16, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>Browse Proposals →</Link>
            <PostRishtaButton variant="hero" />
          </div>

          {/* Stats */}
          <div className="hero-stats">
            {[
              { label: 'Total Proposals', value: stats.total },
              { label: 'Groom Profiles', value: stats.male },
              { label: 'Bride Profiles', value: stats.female },
            ].map(s => (
              <div key={s.label} className="hero-stat-card">
                <div style={{ fontSize: 28, fontWeight: 900 }}><AnimatedCounter target={s.value} /></div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by city */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 20px 0' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1830', marginBottom: 16 }}>Browse by Location</h2>
        <CitySlider cities={cities} />
        <div style={{ marginTop: 12 }}>
          <CountrySlider countries={countries} />
        </div>
      </section>

{/* Recently Added */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1830' }}>Recently Added</h2>
          <Link href="/proposals" style={{ fontSize: 13, color: '#534AB7', fontWeight: 700, textDecoration: 'none' }}>View all →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {recent.map(p => <ProposalCard key={p.id} proposal={p} />)}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: '#EEEDFE', padding: '56px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>How It Works</h2>
          <p style={{ color: '#6B6893', marginBottom: 40 }}>Simple, safe, and trusted by families across Pakistan</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            {[
              {
                step: '1', title: 'Post Your Rishta', desc: 'Fill out a detailed profile, pay the fee, and wait for approval.',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
              },
              {
                step: '2', title: 'Browse Matches', desc: 'Filter by city, caste, education, and more to find the right person.',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
              },
              {
                step: '3', title: 'Connect Directly', desc: 'Contact families directly — no middlemen, no hidden fees.',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02z"/></svg>,
              },
            ].map(item => (
              <div key={item.step} style={{ background: '#fff', borderRadius: 20, padding: '28px 20px', boxShadow: '0 2px 12px rgba(83,74,183,0.08)', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, margin: '0 auto 16px' }}>{item.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#534AB7', letterSpacing: 1, marginBottom: 8 }}>STEP {item.step}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1830', marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 13.5, color: '#6B6893', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <PostRishtaButton variant="cta" />
        </div>
      </section>
    </div>
  );
}
