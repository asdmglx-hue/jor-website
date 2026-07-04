import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://joronline.com';
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/my-proposal', '/login'] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
