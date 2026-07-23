import { MetadataRoute } from 'next';
import { getQualifyingCategoryEntries, getQualifyingCountries, fetchAllProposalNumbers, fetchAllBlogSlugs } from '@/lib/supabase';

// Refreshed at most once an hour — the sitemap doesn't need to be
// instant, but under 'force-static' it would never update again after
// the first build, silently going stale as new profiles get added.
export const revalidate = 3600;

const BASE = 'https://joronline.com';
const GENDER_SLUGS = ['bride', 'groom'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/proposals`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/plans`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/stories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/refer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Same qualifying-page check every other part of the site uses (see
  // lib/supabase.ts's getQualifyingCategoryEntries/getQualifyingCountries,
  // which are themselves now backed by the same shared database functions
  // the mobile app's Featured-booking picker calls) — calling the exact
  // same functions here, rather than independently recomputing "which
  // pages qualify" a third time, guarantees the sitemap can never list a
  // page that doesn't actually exist, or omit one that does.
  const [qualifyingEntries, qualifyingCountries, proposalNumbers] = await Promise.all([
    getQualifyingCategoryEntries(),
    getQualifyingCountries(),
    fetchAllProposalNumbers(),
  ]);

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

  const overseasPages: MetadataRoute.Sitemap = qualifyingCountries.map(c => ({
    url: `${BASE}/proposals/overseas/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  // Individual profile pages — names are kept out of the static HTML
  // (fetched client-side instead), so these are safe to index for their
  // genuinely unique long-tail content (age, city, profession, bio)
  // without making anyone's name itself Google-searchable.
  const profilePages: MetadataRoute.Sitemap = proposalNumbers.map(num => ({
    url: `${BASE}/profile/${num}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  const blogSlugs = await fetchAllBlogSlugs();
  const blogPages: MetadataRoute.Sitemap = blogSlugs.map(post => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.published_at),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...cityGenderPages, ...overseasPages, ...profilePages, ...blogPages];
}
