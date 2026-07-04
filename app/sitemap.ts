import { MetadataRoute } from 'next';
import { fetchCategoryCounts, fetchCountryCounts, MIN_CATEGORY_PROFILES } from '@/lib/supabase';
import { CATEGORY_ENTRIES, slugify } from '@/lib/categories';

export const dynamic = 'force-static';

const BASE = 'https://joronline.com';
const GENDER_SLUGS = ['bride', 'groom'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/proposals`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/plans`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/refer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Same "does this page actually have enough real profiles behind it"
  // check used by generateStaticParams on these pages — keeps the sitemap
  // from ever listing a thin/empty page that would hurt more than help.
  const [cityCounts, casteCounts, sectCounts, maritalCounts, professionCounts, countryCounts] = await Promise.all([
    fetchCategoryCounts('city'),
    fetchCategoryCounts('caste'),
    fetchCategoryCounts('sect'),
    fetchCategoryCounts('marital_status'),
    fetchCategoryCounts('profession'),
    fetchCountryCounts(),
  ]);
  const countsByColumn: Record<string, Record<string, number>> = {
    city: cityCounts, caste: casteCounts, sect: sectCounts, marital_status: maritalCounts, profession: professionCounts,
  };

  const qualifyingEntries = CATEGORY_ENTRIES.filter(e => (countsByColumn[e.dbColumn]?.[e.value] ?? 0) >= MIN_CATEGORY_PROFILES);

  const categoryPages: MetadataRoute.Sitemap = qualifyingEntries.map(e => ({
    url: `${BASE}/proposals/${e.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const cityGenderPages: MetadataRoute.Sitemap = qualifyingEntries
    .filter(e => e.type === 'city')
    .flatMap(city => GENDER_SLUGS.map(gender => ({
      url: `${BASE}/proposals/${city.slug}/${gender}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })));

  const overseasPages: MetadataRoute.Sitemap = Object.entries(countryCounts)
    .filter(([, count]) => count >= MIN_CATEGORY_PROFILES)
    .map(([value]) => ({
      url: `${BASE}/proposals/overseas/${slugify(value)}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    }));

  return [...staticPages, ...categoryPages, ...cityGenderPages, ...overseasPages];
}
