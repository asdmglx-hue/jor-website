import { fetchCategoryCounts, fetchProposalsForCategory, MIN_CATEGORY_PROFILES } from '@/lib/supabase';
import { CATEGORY_ENTRIES, resolveCategoryBySlug } from '@/lib/categories';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import CategoryPageClient from '@/components/CategoryPageClient';

type Props = { params: Promise<{ slug: string; gender: string }> };

// 'bride' / 'groom' are the real search terms people use — not 'female' /
// 'male', which is the underlying DB value.
const GENDER_SLUGS: Record<string, string> = { bride: 'Female', groom: 'Male' };

// Only city slugs get a /{gender} sub-route — caste/sect/profession pages
// don't (matches a much less common real search pattern for those).
export async function generateStaticParams() {
  const cityCounts = await fetchCategoryCounts('city');
  const qualifyingCities = CATEGORY_ENTRIES.filter(
    e => e.type === 'city' && (cityCounts[e.value] ?? 0) >= MIN_CATEGORY_PROFILES
  );
  const params: { slug: string; gender: string }[] = [];
  for (const city of qualifyingCities) {
    for (const gender of Object.keys(GENDER_SLUGS)) {
      params.push({ slug: city.slug, gender });
    }
  }
  return params;
}

// Same reasoning as the city/category page — small page count, existing
// qualifying-count check kept exactly as-is, just adding freshness on top.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, gender } = await params;
  const entry = resolveCategoryBySlug(slug);
  const genderValue = GENDER_SLUGS[gender];
  if (!entry || entry.type !== 'city' || !genderValue) return { title: 'Not Found | Jor' };
  const label = gender === 'bride' ? 'Bride' : 'Groom';
  return {
    title: `${label} Profiles in ${entry.value} | Jor – Pakistan's Trusted Matrimonial Platform`,
    description: `Browse verified ${label.toLowerCase()} rishta profiles in ${entry.value}. Find your perfect match on Jor, Pakistan's trusted matrimonial platform.`,
    alternates: { canonical: `https://joronline.com/proposals/${entry.slug}/${gender}` },
  };
}

export default async function CityGenderPage({ params }: Props) {
  const { slug, gender } = await params;
  const entry = resolveCategoryBySlug(slug);
  const genderValue = GENDER_SLUGS[gender];
  if (!entry || entry.type !== 'city' || !genderValue) notFound();

  const { proposals, featured } = await fetchProposalsForCategory('city', entry.value, 24, { gender: genderValue });
  if (proposals.length === 0 && featured.length === 0) notFound();

  const label = gender === 'bride' ? 'Bride' : 'Groom';

  const cityCounts = await fetchCategoryCounts('city');
  const qualifyingCitySlugs = Object.fromEntries(
    CATEGORY_ENTRIES.filter(e => e.type === 'city' && (cityCounts[e.value] ?? 0) >= MIN_CATEGORY_PROFILES)
      .map(e => [e.value, e.slug])
  );

  const allForJsonLd = [...featured, ...proposals];
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://joronline.com' },
      { '@type': 'ListItem', position: 2, name: 'Proposals', item: 'https://joronline.com/proposals' },
      { '@type': 'ListItem', position: 3, name: entry.value, item: `https://joronline.com/proposals/${entry.slug}` },
      { '@type': 'ListItem', position: 4, name: `${label}s` },
    ],
  };
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: allForJsonLd.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://joronline.com/profile/${p.proposal_number}`,
      name: `${label} #${p.proposal_number}`,
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
        <Link href={`/proposals/${entry.slug}`} style={{ color: '#534AB7', textDecoration: 'none' }}>{entry.value}</Link>
        {' › '}
        <span>{label}s</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>{label} Profiles in {entry.value}</h1>
      <p style={{ fontSize: 14, color: '#6B6893', marginBottom: 24 }}>
        Browse verified {label.toLowerCase()} rishta profiles from {entry.value}. Connect directly with families across Pakistan.
      </p>

      <CategoryPageClient
        initialProposals={proposals}
        featured={featured}
        initialFilters={{ city: entry.value, gender: genderValue }}
        locationField="city"
        qualifyingSlugs={qualifyingCitySlugs}
        hasGenderSegment
      />
    </div>
  );
}
