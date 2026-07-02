import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://jor.com.pk', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://jor.com.pk/proposals', lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: 'https://jor.com.pk/register', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://jor.com.pk/plans', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://jor.com.pk/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://jor.com.pk/refer', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://jor.com.pk/privacy-policy', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://jor.com.pk/terms', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];
}
