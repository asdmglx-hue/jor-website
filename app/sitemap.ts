import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://joronline.com', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://joronline.com/proposals', lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: 'https://joronline.com/register', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://joronline.com/plans', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://joronline.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://joronline.com/refer', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://joronline.com/privacy-policy', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://joronline.com/terms', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];
}
