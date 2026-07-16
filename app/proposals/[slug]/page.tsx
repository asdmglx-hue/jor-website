import { fetchProposalsForCategory, getQualifyingCategoryEntries } from '@/lib/supabase';
import { resolveCategoryBySlug, categoryPageTitle } from '@/lib/categories';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import CategoryPageClient from '@/components/CategoryPageClient';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const entries = await getQualifyingCategoryEntries();
  return entries.map(e => ({ slug: e.slug }));
}

// Category pages are a small minority of the site's total pages, so we
// keep the existing pre-build + qualifying-count safety check exactly as
// it was (removing it would need the same minimum-profile check re-added
// at runtime, for very little build-speed benefit given how few of these
// pages there are compared to individual profiles). Just adding a
// freshness timer on top, same as everywhere else.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = resolveCategoryBySlug(slug);
  if (!entry) return { title: 'Not Found | Jor' };
  const title = categoryPageTitle(entry);
  return {
    title: `${title} | Jor – Pakistan's Trusted Matrimonial Platform`,
    description: entry.type === 'city'
      ? `Browse verified rishta proposals in ${entry.value}. Find your perfect match from ${entry.value} on Jor, Pakistan's trusted matrimonial platform.`
      : `Browse verified ${entry.value} rishta proposals on Jor. Connect directly with families — no middlemen, no hidden fees.`,
    alternates: { canonical: `https://joronline.com/proposals/${entry.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const entry = resolveCategoryBySlug(slug);
  if (!entry) notFound();

  const proposals = await fetchProposalsForCategory(entry.dbColumn as never, entry.value, 24);
  if (proposals.length === 0) notFound();

  const title = categoryPageTitle(entry);

  // Only needed so the filter bar can correctly send someone to another
  // city's own dedicated page if they change it — not relevant for
  // caste/sect/profession pages, so only computed when actually needed.
  let qualifyingCitySlugs: Record<string, string> = {};
  if (entry.type === 'city') {
    const qualifying = await getQualifyingCategoryEntries();
    qualifyingCitySlugs = Object.fromEntries(qualifying.filter(e => e.type === 'city').map(e => [e.value, e.slug]));
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://joronline.com' },
      { '@type': 'ListItem', position: 2, name: 'Proposals', item: 'https://joronline.com/proposals' },
      { '@type': 'ListItem', position: 3, name: entry.value },
    ],
  };
  // Masked labels only ("Groom #1854"), same rule as the profile pages —
  // never a real name in static HTML.
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
        <span>{entry.value}</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>{title}</h1>
      <p style={{ fontSize: 14, color: '#6B6893', marginBottom: 24 }}>
        {entry.type === 'city'
          ? `Browse verified rishta proposals from ${entry.value}. Connect directly with families across Pakistan.`
          : `Browse verified ${entry.value.toLowerCase()} rishta proposals. Connect directly with families — no middlemen, no hidden fees.`}
      </p>

      <CategoryPageClient
        initialProposals={proposals}
        initialFilters={entry.type === 'city' ? { city: entry.value } : { [entry.dbColumn === 'marital_status' ? 'maritalStatus' : entry.dbColumn]: entry.value }}
        locationField="city"
        qualifyingSlugs={qualifyingCitySlugs}
      />
    </div>
  );
}
