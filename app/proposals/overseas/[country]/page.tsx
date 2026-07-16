import { fetchProposalsForCategory, getQualifyingCountries } from '@/lib/supabase';
import { slugify } from '@/lib/categories';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import CategoryPageClient from '@/components/CategoryPageClient';

type Props = { params: Promise<{ country: string }> };

export async function generateStaticParams() {
  const countries = await getQualifyingCountries();
  return countries.map(c => ({ country: c.slug }));
}

// Same reasoning as the other category pages.
export const revalidate = 300;

async function resolveCountrySlug(slug: string): Promise<string | null> {
  const countries = await getQualifyingCountries();
  return countries.find(c => c.slug === slug)?.value ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const value = await resolveCountrySlug(country);
  if (!value) return { title: 'Not Found | Jor' };
  return {
    title: `Overseas Rishta in ${value} | Jor – Pakistan's Trusted Matrimonial Platform`,
    description: `Browse verified Pakistani rishta proposals for families based in ${value}. Connect directly — no middlemen, no hidden fees.`,
    alternates: { canonical: `https://joronline.com/proposals/overseas/${slugify(value)}` },
  };
}

export default async function OverseasCountryPage({ params }: Props) {
  const { country } = await params;
  const value = await resolveCountrySlug(country);
  if (!value) notFound();

  const proposals = await fetchProposalsForCategory('country', value, 24);
  if (proposals.length === 0) notFound();

  const qualifyingCountries = await getQualifyingCountries();
  const qualifyingCountrySlugs = Object.fromEntries(qualifyingCountries.map(c => [c.value, c.slug]));

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://joronline.com' },
      { '@type': 'ListItem', position: 2, name: 'Proposals', item: 'https://joronline.com/proposals' },
      { '@type': 'ListItem', position: 3, name: `Overseas — ${value}` },
    ],
  };
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: proposals.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://joronline.com/profile/${p.proposal_number}`,
      name: `${p.gender === 'Male' ? 'Groom' : 'Bride'} #${p.proposal_number}`,
    })),
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <div style={{ fontSize: 13, color: '#B0ADCB', marginBottom: 12 }}>
        <Link href="/" style={{ color: '#534AB7', textDecoration: 'none' }}>Home</Link>
        {' › '}
        <Link href="/proposals" style={{ color: '#534AB7', textDecoration: 'none' }}>Proposals</Link>
        {' › '}
        <span>Overseas — {value}</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Overseas Rishta in {value}</h1>
      <p style={{ fontSize: 14, color: '#6B6893', marginBottom: 24 }}>
        Browse verified rishta proposals for Pakistani families based in {value}. Connect directly — no middlemen, no hidden fees.
      </p>

      <CategoryPageClient
        initialProposals={proposals}
        initialFilters={{ overseas: true, country: value }}
        locationField="country"
        qualifyingSlugs={qualifyingCountrySlugs}
      />
    </div>
  );
}
