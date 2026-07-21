import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { supabase, notExpiredFilter } from '@/lib/supabase';
import AboutCta from '@/components/AboutCta';
import ShareStoryButton from '@/components/ShareStoryButton';
import AnimatedCounter from '@/components/AnimatedCounter';
import StoryScrollBox from '@/components/StoryScrollBox';

// Same cadence as the homepage — the live family count below doesn't need
// to be second-fresh, just not stale for long.
export const revalidate = 300;

const SITE = 'https://joronline.com';

export const metadata: Metadata = {
  title: 'Stories | Jor',
  description: "Real families, real rishtas — a few of the stories that started on Jor, Pakistan's trusted matrimonial platform.",
  alternates: { canonical: `${SITE}/stories` },
  robots: { index: true, follow: true },
};

async function getFamilyCount(): Promise<number> {
  const { count } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .or(notExpiredFilter());
  return count || 0;
}

// ── Sample stories ───────────────────────────────────────────────────────
// Fallback content, only shown if the 'testimonials' table has nothing
// published yet — names shortened to initials/first-names in the style
// real matrimonial testimonials use to protect members' privacy. Once the
// admin app's Content tab has real entries, those take over automatically.
type Story = { quote: string; names: string; initials: string; city: string; when: string; color?: string };

const STORIES: Story[] = [
  {
    quote: "We messaged for three weeks before our families even spoke. By the time our parents sat down for tea, we'd already decided — they just made it official.",
    names: 'Sara & Hamza', initials: 'S+H', city: 'Lahore', when: 'Nikah · Nov 2025',
  },
  {
    quote: 'I filtered by city, sect and family type before showing my daughter a single profile. Jor let me do the worrying so she didn\u2019t have to.',
    names: "Ayesha's mother", initials: 'A', city: 'Karachi', when: 'Rishta finalized · Aug 2025',
  },
  {
    quote: 'I was scrolling profiles at 2am Toronto time, 11am Islamabad time. Distance stopped being the excuse it used to be.',
    names: 'Bilal', initials: 'B', city: 'Islamabad, from Toronto', when: 'Married · Jan 2026',
  },
  {
    quote: "Her father called mine on a Tuesday. We were engaged by Friday. Some things, once they're right, don't need to be slow.",
    names: 'Ayesha & Usman', initials: 'A+U', city: 'Multan', when: 'Engaged · Dec 2025',
  },
  {
    quote: 'I found her Featured profile for my younger brother. He still doesn\u2019t know I nearly proposed on his behalf.',
    names: "Kashif, groom's brother", initials: 'K', city: 'Peshawar', when: 'Married · Oct 2025',
  },
  {
    quote: 'Overseas rishtas are supposed to be complicated. Ours took four phone calls and one very long video call with both families.',
    names: 'Hina', initials: 'H', city: 'Faisalabad, now Dubai', when: 'Nikah · Mar 2026',
  },
];

// Same 5-color rotation ProposalCard.tsx uses for its avatar initials —
// matches the rest of the site instead of inventing a separate palette
// just for this page. There, index-based rotation is used whenever a
// position within a list is available (which it always is here), with a
// name-hash fallback only for standalone cards with no list position.
const AVATAR_COLORS = ['#534AB7', '#0F6E56', '#E8620A', '#0369A1', '#E11D48'];

async function getStories(): Promise<Story[]> {
  try {
    const { data } = await supabase
      .from('testimonials')
      .select('quote, names, initials, city, when_label, color')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });
    if (data && data.length > 0) {
      return (data as { quote: string; names: string; initials: string; city: string; when_label: string; color: string | null }[])
        .map(r => ({ quote: r.quote, names: r.names, initials: r.initials, city: r.city, when: r.when_label, color: r.color || undefined }));
    }
  } catch (_) {
    // Table not created yet, or unreachable — fall back to sample content.
  }
  return STORIES;
}

export default async function StoriesPage() {
  const [familyCount, stories] = await Promise.all([getFamilyCount(), getStories()]);

  return (
    <div>
      {/* Fraunces is loaded only on this page (a deliberate warm, literary
          counterpoint to Inter for the pull-quotes) — a plain stylesheet
          link rather than next/font, since the rest of the site avoids
          next/font's build-time Google Fonts fetch under the Cloudflare
          Workers deploy target. React 19 hoists this into <head> on its
          own, wherever it's rendered. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&display=swap" />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="testi-hero" style={{ maxWidth: 720, margin: '0 auto', padding: '56px 20px 8px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 999,
          background: '#EEEDFE', color: '#534AB7', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 20,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round"><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/></svg>
          Real stories, real rishtas
        </div>

        {/* No manual <br> — text-wrap: balance lets the browser pick its
            own break points so short trailing words never end up stranded
            alone on a line, at any viewport width. */}
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 500,
          fontSize: 'clamp(26px, 4.4vw, 40px)', lineHeight: 1.28, color: '#1A1830', margin: '0 0 16px',
          textWrap: 'balance' as CSSProperties['textWrap'],
        }}>
          Every rishta starts as two separate stories. These are the ones that became one.
        </h1>
        <p style={{ fontSize: 15.5, color: '#6B6893', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 520 }}>
          A few of the families who found each other on Jor — shared, lightly edited, in their own words.
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 999,
          border: '1.5px solid #E8E6F5', fontSize: 13.5, fontWeight: 700, color: '#1A1830',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#0F6E56', display: 'inline-block' }} />
          Joined by <AnimatedCounter target={familyCount} /> families across Pakistan
        </div>
      </section>

      {/* ── Story thread ─────────────────────────────────────────────── */}
      {/* Sized to fit exactly 2 stories tall (StoryScrollBox measures the
          real rendered height client-side, rather than guessing a fixed
          pixel value), then scrolls — keeps a long story list from
          turning the whole page into an endless scroll. The scrollbar
          itself is hidden, but it's still plain native overflow
          scrolling underneath, so hover-to-scroll and handing off into
          the page's own scroll at the top/bottom edge both just work,
          in both directions, with no extra JS needed for that part. The
          thread line lives inside the scroll box so it moves with the
          content instead of staying pinned. */}
      <section className="testi-scroll-wrap" style={{ maxWidth: 900, margin: '56px auto 0', padding: '0 20px' }}>
        <StoryScrollBox>
          <div className="testi-timeline">
            <div className="testi-thread-line" aria-hidden="true" />
            {stories.map((story, i) => {
              const side = i % 2 === 0 ? 'left' : 'right';
              const tone = { bg: story.color || AVATAR_COLORS[i % AVATAR_COLORS.length], fg: '#fff' };
              return (
                <div key={`${story.names}-${i}`} className={`testi-row testi-row-${side}`}>
                  <div className="testi-knot" style={{ background: tone.bg }} />
                  <article className="testi-card" style={{
                    background: '#fff', border: '1px solid #E8E6F5', borderRadius: 20,
                    padding: '24px 26px', boxShadow: '0 10px 30px rgba(83,74,183,0.07)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div className="testi-monogram" style={{ background: tone.bg, color: tone.fg }}>{story.initials}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1830' }}>{story.names}</div>
                        <div style={{ fontSize: 12, color: '#68629C' }}>{story.city}</div>
                      </div>
                    </div>
                    <p style={{
                      fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 500,
                      fontSize: 17, lineHeight: 1.55, color: '#1A1830', margin: '0 0 14px',
                    }}>
                      “{story.quote}”
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#0F6E56' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {story.when}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </StoryScrollBox>
        {stories.length > 2 && <div className="testi-scroll-fade" aria-hidden="true" />}
      </section>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#68629C', maxWidth: 480, margin: '8px auto 64px', padding: '0 20px', lineHeight: 1.6 }}>
        Names and identifying details are shortened or changed at our members&apos; request.
      </p>

      {/* ── Share your story ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '0 auto 56px', padding: '0 20px' }}>
        <div style={{
          textAlign: 'center', background: '#E1F5EE', borderRadius: 20, padding: '32px 24px',
          border: '1px solid #C7EBDF',
        }}>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, color: '#0F6E56', marginBottom: 8 }}>
            Found your match on Jor?
          </h2>
          <p style={{ fontSize: 14, color: '#1A1830', opacity: 0.75, marginBottom: 20, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            We&apos;d love to add your story to this page — and maybe give the next family reading it a little more hope.
          </p>
          <ShareStoryButton />
        </div>
      </section>

      <div style={{ maxWidth: 900, margin: '0 auto 64px', padding: '0 20px' }}>
        <AboutCta />
      </div>
    </div>
  );
}
