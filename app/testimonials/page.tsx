import type { Metadata } from 'next';
import { supabase, notExpiredFilter } from '@/lib/supabase';
import AboutCta from '@/components/AboutCta';
import ShareStoryButton from '@/components/ShareStoryButton';
import AnimatedCounter from '@/components/AnimatedCounter';

// Same cadence as the homepage — the live family count below doesn't need
// to be second-fresh, just not stale for long.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Real Rishta Stories | Jor',
  description: "Real families, real rishtas — a few of the stories that started on Jor, Pakistan's trusted matrimonial platform.",
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
// Placeholder content — names shortened to initials/first-names in the
// style real matrimonial testimonials use to protect members' privacy.
// Swap these for real submissions (the "Share your story" WhatsApp button
// below is the intended intake channel) before this goes live.
type Story = { quote: string; names: string; initials: string; city: string; when: string };

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

const MONOGRAM_TONES = [
  { bg: '#534AB7', fg: '#fff' },
  { bg: '#0F6E56', fg: '#fff' },
  { bg: '#E8620A', fg: '#fff' },
  { bg: '#3D35A0', fg: '#fff' },
  { bg: '#1A1830', fg: '#fff' },
  { bg: '#534AB7', fg: '#fff' },
];

export default async function TestimonialsPage() {
  const familyCount = await getFamilyCount();

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

        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 500,
          fontSize: 'clamp(26px, 4.4vw, 40px)', lineHeight: 1.28, color: '#1A1830', margin: '0 0 16px',
        }}>
          Every rishta starts as two separate stories.<br className="hero-br" /> These are the ones that became one.
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
      <section className="testi-timeline" style={{ maxWidth: 900, margin: '56px auto 0', padding: '0 20px', position: 'relative' }}>
        <div className="testi-thread-line" aria-hidden="true" />
        {STORIES.map((story, i) => {
          const side = i % 2 === 0 ? 'left' : 'right';
          const tone = MONOGRAM_TONES[i % MONOGRAM_TONES.length];
          return (
            <div key={story.names} className={`testi-row testi-row-${side}`}>
              <div className="testi-knot" style={{ background: tone.bg }} />
              <article className="testi-card" style={{
                background: '#fff', border: '1px solid #E8E6F5', borderRadius: 20,
                padding: '24px 26px', boxShadow: '0 10px 30px rgba(83,74,183,0.07)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div className="testi-monogram" style={{ background: tone.bg, color: tone.fg }}>{story.initials}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1830' }}>{story.names}</div>
                    <div style={{ fontSize: 12, color: '#B0ADCB' }}>{story.city}</div>
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
      </section>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#B0ADCB', maxWidth: 480, margin: '8px auto 64px', padding: '0 20px', lineHeight: 1.6 }}>
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
