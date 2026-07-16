import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchBlogPostBySlug } from '@/lib/supabase';
import AboutCta from '@/components/AboutCta';
import BlogShareButton from '@/components/BlogShareButton';

export const revalidate = 300;

const SITE = 'https://joronline.com';

// ── Lightweight content formatting ───────────────────────────────────────
// Deliberately not a full markdown library — the admin app's content field
// is a single plain-text box, and it should stay that way (simple to
// write in, nothing to configure). This just recognizes a handful of
// plain-text conventions someone would naturally type anyway, and turns
// them into real semantic HTML: "## " and "### " become actual <h2>/<h3>
// headings (which matters for SEO — Google uses heading structure to
// pick featured snippets, and a wall of undifferentiated paragraphs
// can't be excerpted the same way), "**bold**" becomes <strong>,
// "[text](url)" becomes a real link, and a block of "- " lines becomes
// a proper <ul>. Anything that doesn't match these patterns still just
// renders as a plain paragraph, exactly as before.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) tokens.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      tokens.push(<strong key={`${keyPrefix}-b-${i++}`}>{match[1]}</strong>);
    } else {
      const label = match[2];
      const href = match[3];
      const external = !href.startsWith('/');
      tokens.push(
        <a key={`${keyPrefix}-l-${i++}`} href={href} style={{ color: '#534AB7', fontWeight: 700, textDecoration: 'underline' }}
          target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
          {label}
        </a>
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) tokens.push(text.slice(lastIndex));
  return tokens;
}

function renderContent(content: string): ReactNode {
  const blocks = content.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocks.map((block, i) => {
    if (block.startsWith('### ')) {
      return <h3 key={i} style={{ fontSize: 19, fontWeight: 800, color: '#1A1830', margin: '28px 0 12px' }}>{renderInline(block.slice(4), `h3-${i}`)}</h3>;
    }
    if (block.startsWith('## ')) {
      return <h2 key={i} style={{ fontSize: 22, fontWeight: 800, color: '#1A1830', margin: '32px 0 14px' }}>{renderInline(block.slice(3), `h2-${i}`)}</h2>;
    }
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const isList = lines.length > 0 && lines.every(l => l.startsWith('- ') || l.startsWith('* '));
    if (isList) {
      return (
        <ul key={i} style={{ margin: '0 0 20px', paddingLeft: 22 }}>
          {lines.map((l, li) => (
            <li key={li} style={{ fontSize: 16, lineHeight: 1.8, color: '#1A1830', marginBottom: 6 }}>
              {renderInline(l.replace(/^[-*]\s+/, ''), `li-${i}-${li}`)}
            </li>
          ))}
        </ul>
      );
    }
    return <p key={i} style={{ margin: '0 0 20px' }}>{renderInline(block, `p-${i}`)}</p>;
  });
}

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
        <img
          src={post.cover_image_url}
          alt={post.title}
          width={1200}
          height={630}
          fetchPriority="high"
          style={{ width: '100%', height: 'auto', aspectRatio: '1200 / 630', objectFit: 'cover', borderRadius: 16, marginBottom: 28, display: 'block' }}
        />
      )}

      <div style={{ fontSize: 16, lineHeight: 1.8, color: '#1A1830' }}>
        {renderContent(post.content)}
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
