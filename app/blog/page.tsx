import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchBlogPosts } from '@/lib/supabase';
import AboutCta from '@/components/AboutCta';

// Same on-demand ISR pattern as the rest of the site (e.g. /stories) —
// renders fresh on first visit after this window, then serves the cached
// version until the next visitor after that triggers a background
// refresh. New posts show up without a redeploy.
export const revalidate = 300;

const SITE = 'https://joronline.com';

export const metadata: Metadata = {
  title: 'Blog — Rishta Advice & Wedding Planning | Jor',
  description: 'Practical rishta advice, wedding planning tips, and real stories from Pakistani families — from Jor, Pakistan\u2019s trusted matrimonial platform.',
  alternates: { canonical: `${SITE}/blog` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'The Jor Blog — Rishta Advice & Wedding Planning',
    description: 'Practical rishta advice, wedding planning tips, and real stories from Pakistani families.',
    url: `${SITE}/blog`,
    type: 'website',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const CARD_COLORS = ['#534AB7', '#0F6E56', '#E8620A', '#0369A1', '#E11D48'];

export default async function BlogIndexPage() {
  const posts = await fetchBlogPosts();

  // ItemList + Blog structured data — tells search engines this page is a
  // list of articles, and gives each one a position, so a listing like
  // "Jor Blog articles" can be understood (and potentially shown with
  // rich results) without Google having to guess from the HTML alone.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'The Jor Blog',
    url: `${SITE}/blog`,
    publisher: { '@type': 'Organization', name: 'Jor', url: SITE },
    blogPost: posts.map(p => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE}/blog/${p.slug}`,
      datePublished: p.published_at,
      description: p.excerpt,
      author: { '@type': 'Person', name: p.author },
    })),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section style={{ maxWidth: 720, margin: '0 auto', padding: '56px 20px 8px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 999,
          background: '#EEEDFE', color: '#534AB7', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 20,
        }}>
          The Jor Blog
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 4.4vw, 38px)', fontWeight: 900, lineHeight: 1.2, color: '#1A1830', margin: '0 0 16px' }}>
          Rishta advice, wedding planning, and everything in between
        </h1>
        <p style={{ fontSize: 15.5, color: '#6B6893', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 520 }}>
          Practical guidance from Jor for families navigating rishta, nikah, and everything that comes with it.
        </p>
      </section>

      <section style={{ maxWidth: 1100, margin: '32px auto 0', padding: '0 20px' }}>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#B0ADCB' }}>
            <p style={{ fontSize: 14 }}>No posts published yet — check back soon.</p>
          </div>
        ) : (
          <div className="blog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {posts.map((post, i) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #E8E6F5', borderRadius: 18, overflow: 'hidden' }}
              >
                <div style={{
                  height: 140, background: post.cover_image_url ? undefined : CARD_COLORS[i % CARD_COLORS.length],
                  backgroundImage: post.cover_image_url ? `url(${post.cover_image_url})` : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!post.cover_image_url && (
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
                  )}
                </div>
                <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {post.category && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#534AB7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{post.category}</span>
                  )}
                  <h2 style={{ fontSize: 16.5, fontWeight: 800, color: '#1A1830', lineHeight: 1.35, margin: '0 0 8px' }}>{post.title}</h2>
                  <p className="line-clamp-2" style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.55, margin: '0 0 14px', flex: 1 }}>{post.excerpt}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#B0ADCB' }}>
                    <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
                    <span>·</span>
                    <span>{post.read_time_minutes} min read</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div style={{ maxWidth: 900, margin: '56px auto 64px', padding: '0 20px' }}>
        <AboutCta />
      </div>
    </div>
  );
}
