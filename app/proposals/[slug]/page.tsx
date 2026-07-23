import { fetchProposalsForCategory, getQualifyingCategoryEntries, fetchFeaturedForCarousel } from '@/lib/supabase';
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

  const { proposals, featured: locationFeatured } = await fetchProposalsForCategory(entry.dbColumn as never, entry.value, 24);
  // Only city/country pages have a real "boosted for this specific
  // location" concept (see fetchProposalsForCategory) — every other
  // dedicated category page (caste, sect, marital status, profession)
  // instead prefers boosted profiles that ALSO match this exact page's
  // own value (e.g. the Barelvi page prefers boosted Barelvi profiles),
  // falling back to the general "everyone currently boosted" list only
  // if there are zero such matches — see fetchFeaturedForCarousel's own
  // comment for why an empty-fallback safety net matters here.
  const featured = entry.type === 'city' ? locationFeatured : await fetchFeaturedForCarousel({ [entry.type]: entry.value });
  if (proposals.length === 0 && featured.length === 0) notFound();

  const title = categoryPageTitle(entry);

  // Every value of THIS SAME category type that has its own dedicated
  // page — so the filter bar can correctly send someone to another
  // caste/sect/city/etc.'s own page if they change it, not just cities.
  // Previously only computed for city pages, which meant changing the
  // filter on a caste/sect/profession/marital-status page never actually
  // navigated anywhere — it silently filtered in place while the heading
  // (fixed from the URL) stayed on the old value.
  const qualifying = await getQualifyingCategoryEntries();
  const qualifyingSlugs = Object.fromEntries(
    qualifying.filter(e => e.type === entry.type).map(e => [e.value, e.slug])
  );

  const allForJsonLd = [...featured, ...proposals];
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
    itemListElement: allForJsonLd.map((p, i) => ({
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
      <div style={{ fontSize: 13, color: '#68629C', marginBottom: 12 }}>
        <Link href="/" style={{ color: '#534AB7', textDecoration: 'none' }}>Home</Link>
        {' › '}
        <Link href="/proposals" style={{ color: '#534AB7', textDecoration: 'none' }}>Proposals</Link>
        {' › '}
        <span>{entry.value}</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>{title}</h1>
      <p style={{ fontSize: 14, color: '#6B6893', marginBottom: 24 }}>
        Browse verified marriage proposals from Pakistan and Abroad, and connect directly with families.
      </p>

      <CategoryPageClient
        initialProposals={proposals}
        featured={featured}
        initialFilters={entry.type === 'city' ? { city: entry.value } : { [entry.dbColumn === 'marital_status' ? 'maritalStatus' : entry.dbColumn]: entry.value }}
        locationField={entry.type}
        qualifyingSlugs={qualifyingSlugs}
      />
    </div>
  );
}
