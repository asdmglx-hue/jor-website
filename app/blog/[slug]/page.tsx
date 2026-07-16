import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchBlogPostBySlug } from '@/lib/supabase';
import AboutCta from '@/components/AboutCta';
import BlogShareButton from '@/components/BlogShareButton';

export const revalidate = 300;

const SITE = 'https://joronline.com';

type Props = { params: Promise<{ slug: string }> };

// Shares one fetch between generateMetadata and the page body instead of
// fetching the same row twice per request.
const getCachedPost = cache((slug: string) => fetchBlogPostBySlug(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCachedPost(slug);
  if (!post) return { title: 'Post Not Found | Jor Blog' };

  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt;

  return {
    title: `${title} | Jor Blog`,
    description,
    keywords: post.keywords.length > 0 ? post.keywords : undefined,
    alternates: { canonical: `${SITE}/blog/${post.slug}` },
    robots: { index: true, follow: true },
    authors: [{ name: post.author }],
    openGraph: {
      title,
      description,
      url: `${SITE}/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.published_at,
      authors: [post.author],
      images: post.cover_image_url ? [post.cover_image_url] : ['https://joronline.com/hero-wedding.jpg'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getCachedPost(slug);
  if (!post) notFound();

  // Article structured data — headline, author, dates, and image give
  // search engines everything they need to potentially show this as a
  // rich result (and to correctly attribute it as an article rather than
  // a generic page).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.cover_image_url || 'https://joronline.com/hero-wedding.jpg',
    datePublished: post.published_at,
    dateModified: post.published_at,
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'Jor',
      logo: { '@type': 'ImageObject', url: 'https://joronline.com/logo.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/blog/${post.slug}` },
  };

  const paragraphs = post.content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/blog" style={{ fontSize: 13, color: '#534AB7', fontWeight: 700, textDecoration: 'none' }}>&larr; Back to Blog</Link>

      <header style={{ margin: '20px 0 28px' }}>
        {post.category && (
          <span style={{ fontSize: 11, fontWeight: 800, color: '#534AB7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{post.category}</span>
        )}
        <h1 style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, lineHeight: 1.25, color: '#1A1830', margin: '10px 0 16px' }}>{post.title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#6B6893' }}>
          <span style={{ fontWeight: 700, color: '#1A1830' }}>{post.author}</span>
          <span>·</span>
          <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          <span>·</span>
          <span>{post.read_time_minutes} min read</span>
        </div>
      </header>

      {post.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.cover_image_url} alt={post.title} style={{ width: '100%', borderRadius: 16, marginBottom: 28, display: 'block' }} />
      )}

      <div style={{ fontSize: 16, lineHeight: 1.8, color: '#1A1830' }}>
        {paragraphs.map((para, i) => (
          <p key={i} style={{ margin: '0 0 20px' }}>{para}</p>
        ))}
      </div>

      <div style={{ margin: '32px 0', paddingTop: 24, borderTop: '1px solid #E8E6F5' }}>
        <BlogShareButton title={post.title} slug={post.slug} />
      </div>

      <div style={{ marginTop: 40 }}>
        <AboutCta />
      </div>
    </article>
  );
}
