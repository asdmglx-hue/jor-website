import { fetchProposalByNumber, heightDisplay } from '@/lib/supabase';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import ContactButtons from '@/components/ContactButtons';
import ShareButton from '@/components/ShareButton';
import SaveButton from '@/components/SaveButton';
import ProfileName from '@/components/ProfileName';
import ProfileAvatar from '@/components/ProfileAvatar';

// Bios are often written in third person and frequently open with the
// person's actual name ("Muhammad Zaid is a 25-year-old...") — this strips
// literal occurrences of it (full name and first name) before the text
// ever reaches the static HTML, so masking just the heading/photo alone
// doesn't get quietly undone by the bio paragraph itself.
function maskNameInText(text: string | null | undefined, fullName: string, label: string): string {
  if (!text) return '';
  let result = text.split(fullName).join(label);
  const firstName = fullName.trim().split(/\s+/)[0];
  if (firstName && firstName.length > 2) {
    const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), label);
  }
  return result;
}

type Props = { params: Promise<{ id: string }> };

// Pre-renders one static page per active/paused proposal at build time —
// required for output: 'export' (a static site can't look up an arbitrary
// ID at request time, since there's no server to ask). The auto-rebuild
// trigger keeps this list current as profiles are added/removed.
// No generateStaticParams here anymore — with 1256+ profiles, pre-building
// every single one at every deploy was the single biggest source of slow
// builds. Instead, each profile page now renders on-demand the first time
// anyone visits it, then stays cached for 5 minutes before the next
// visitor triggers a background refresh. New profiles work immediately,
// with no rebuild needed at all.
export const revalidate = 300;

// React's cache() deduplicates calls with the same argument within one
// render pass — so generateMetadata and the page component below share a
// single fetch per page instead of two independent ones. This halves (not
// eliminates) the timing window where a profile's data could theoretically
// change between when generateStaticParams listed it and when its
// individual page actually gets built.
const getCachedProposal = cache((num: number) => fetchProposalByNumber(num));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) return { title: 'Proposal Not Found | Jor' };
  const p = await getCachedProposal(num);
  if (!p) return { title: 'Proposal Not Found | Jor' };
  const label = `${p.gender === 'Male' ? 'Groom' : 'Bride'} #${p.proposal_number}`;
  return {
    title: `${label} Profile – ${p.age} yrs, ${p.city} | Jor`,
    description: `${p.profession}, ${p.education}, ${p.caste} from ${p.city}. ${maskNameInText(p.about, p.name, label)}`.slice(0, 160),
    alternates: { canonical: `https://joronline.com/profile/${p.proposal_number}` },
    openGraph: {
      title: `Rishta Proposal – ${p.age} yrs, ${p.city}`,
      description: `${p.profession} from ${p.city}. ${p.caste}, ${p.sect}.`,
      images: [p.profile_photo_url || 'https://joronline.com/hero-wedding.jpg'],
    },
  };
}

function InfoRow({ icon: _icon, label, value }: { icon: string; label: string; value?: string | number | boolean | null }) {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
      <span style={{ fontSize: 13, color: '#6B6893', flex: '0 0 130px' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1830' }}>{display}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#534AB7', marginBottom: 4, paddingBottom: 10, borderBottom: '2px solid #EEEDFE' }}>{title}</h2>
      {children}
    </div>
  );
}

export default async function ProposalDetailPage({ params }: Props) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) notFound();
  const p = await getCachedProposal(num);
  if (!p) notFound();

  const heightFt = p.height_inches ? heightDisplay(p.height_inches) : null;
  const isFeatured = p.subscription_tier === 'featured' || p.is_boosted;


  const label = `${p.gender === 'Male' ? 'Groom' : 'Bride'} #${p.proposal_number}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://joronline.com' },
      { '@type': 'ListItem', position: 2, name: 'Proposals', item: 'https://joronline.com/proposals' },
      { '@type': 'ListItem', position: 3, name: label },
    ],
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: '#B0ADCB', marginBottom: 20 }}>
        <Link href="/" style={{ color: '#534AB7', textDecoration: 'none' }}>Home</Link>
        {' › '}
        <Link href="/proposals" style={{ color: '#534AB7', textDecoration: 'none' }}>Proposals</Link>
        {' › '}
        <span>#{p.proposal_number}</span>
      </div>

      <div className="proposal-detail-grid">
        {/* Main content */}
        <div>
          {/* Header card */}
          <div style={{
            position: 'relative',
            background: isFeatured ? '#FFFBF5' : '#fff',
            border: `1px solid ${isFeatured ? '#E8620A44' : '#E8E6F5'}`,
            borderRadius: 20, padding: '24px', marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            {isFeatured && (
              <span className="featured-badge" style={{ position: 'absolute', right: 24, background: '#E8620A', color: '#fff', fontWeight: 800, borderRadius: 20, letterSpacing: 0.5, display: 'inline-flex', alignItems: 'center', boxShadow: '0 2px 6px rgba(232,98,10,0.4)' }}>
                <svg viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z"/></svg>
                FEATURED
              </span>
            )}
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {/* Photo */}
              <ProfileAvatar
                initial={(p.name || '?').charAt(0).toUpperCase()}
                bgColor={p.gender === 'Male' ? '#534AB7' : '#E11D48'}
                photoUrl={p.profile_photo_url}
                maskedLabel={label}
              />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, minWidth: 0 }}>
                  <ProfileName
                    proposalId={p.id}
                    fallback={`${p.gender === 'Male' ? 'Groom' : 'Bride'} #${p.proposal_number}`}
                    className="profile-name"
                    style={{ fontWeight: 900, color: '#1A1830', margin: 0 }}
                  />
                </div>
                <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.7 }}>
                  <div>{p.age} yrs • {p.country && p.country !== 'Pakistan' ? `${p.country} (from ${p.city})` : `${p.city}, Pakistan`}</div>
                  <div>{p.caste} • {p.sect}</div>
                  <div>{p.profession}</div>
                </div>
              </div>
            </div>
          </div>

          {/* About */}
          {(p.about || p.looking_for) && (
            <Section title="About">
              {p.about && <p style={{ fontSize: 14, color: '#1A1830', lineHeight: 1.7, marginBottom: p.looking_for ? 12 : 0 }}>{maskNameInText(p.about, p.name, label)}</p>}
              {p.looking_for && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#534AB7', marginBottom: 6 }}>Looking For:</div>
                  <p style={{ fontSize: 14, color: '#1A1830', lineHeight: 1.7 }}>{p.looking_for}</p>
                </>
              )}
            </Section>
          )}

          {/* Personal Details */}
          <Section title="Personal Details">
            <InfoRow icon="" label="Height" value={heightFt} />
            <InfoRow icon="" label="Weight" value={p.weight_kg ? `${p.weight_kg} kg` : null} />
            <InfoRow icon="" label="Complexion" value={p.complexion} />
            <InfoRow icon="" label="Marital Status" value={p.marital_status} />
            {p.marital_status !== 'Single' && p.marital_status !== 'Never married' && <InfoRow icon="" label="Children (Boys)" value={p.boys} />}
            {p.marital_status !== 'Single' && p.marital_status !== 'Never married' && <InfoRow icon="" label="Children (Girls)" value={p.girls} />}
            {p.open_to_polygamy && <InfoRow icon="" label="Open to Polygamy" value={p.open_to_polygamy} />}
            <InfoRow icon="" label="Religion Practice Level" value={p.practice_level} />
            {p.gender === 'Female' && <InfoRow icon="" label="Hijab" value={p.hijab} />}
            {p.gender === 'Male' && <InfoRow icon="" label="Beard" value={p.beard} />}
            <InfoRow icon="" label="Languages" value={p.languages?.join(', ')} />
          </Section>

          {/* Education & Career */}
          <Section title="Education & Career">
            <InfoRow icon="" label="Education" value={p.education} />
            <InfoRow icon="" label="Degree" value={p.degree_title} />
            <InfoRow icon="" label="Institute" value={p.institute} />
            {p.degree_title_2 && <InfoRow icon="" label="Degree 2" value={p.degree_title_2} />}
            {p.institute_2 && <InfoRow icon="" label="Institute 2" value={p.institute_2} />}
            {p.degree_title_3 && <InfoRow icon="" label="Degree 3" value={p.degree_title_3} />}
            {p.institute_3 && <InfoRow icon="" label="Institute 3" value={p.institute_3} />}
            <InfoRow icon="" label="Occupation" value={p.profession} />
            <InfoRow icon="" label="Employment" value={p.employment_type} />
            <InfoRow icon="" label="Monthly Income" value={p.monthly_income} />
          </Section>

          {/* Family */}
          <Section title="Family Background">
            {p.family_type && <InfoRow icon="" label="Family Type" value={p.family_type} />}
            <InfoRow icon="" label="Father" value={p.father_alive === true ? 'Alive' : p.father_alive === false ? 'Deceased' : null} />
            <InfoRow icon="" label="Mother" value={p.mother_alive === true ? 'Alive' : p.mother_alive === false ? 'Deceased' : null} />
            <InfoRow icon="‍" label="Brothers" value={p.brothers} />
            <InfoRow icon="‍" label="Sisters" value={p.sisters} />
          </Section>

          {/* Property */}
          <Section title="Property & Assets">
            <InfoRow icon="" label="Home Type" value={p.home_type} />
            <InfoRow icon="" label="Car" value={p.has_car === 'yes' ? (p.car_name || 'Yes') : p.has_car === 'no' ? 'No' : p.has_car} />
            <InfoRow icon="" label="Generator" value={p.has_generator} />
            <InfoRow icon="" label="Solar" value={p.has_solar} />
            <InfoRow icon="" label="Servant" value={p.has_servant} />
          </Section>
        </div>

        {/* Sidebar: Contact */}
        <div className="proposal-sidebar">
          <div style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 20, padding: '24px', boxShadow: '0 4px 20px rgba(83,74,183,0.1)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1A1830', marginBottom: 16 }}>Contact Family</h3>

            <ContactButtons phone={p.contact_phone} phone2={p.contact_phone_2} />

            <div style={{ fontSize: 11, color: '#B0ADCB', textAlign: 'center', lineHeight: 1.6 }}>
              Contact the family directly.<br />No middlemen, no hidden charges.
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: '#B0ADCB', marginBottom: 8 }}>Posted</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6B6893' }}>
                  {new Date(p.posted_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 12, color: '#B0ADCB', marginTop: 4 }}>Proposal #{p.proposal_number}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <SaveButton proposalId={p.id} />
                <ShareButton p={p} compact />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back button */}
      <div style={{ marginTop: 24 }}>
        <Link href="/proposals" style={{ color: '#534AB7', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          ← Back to Proposals
        </Link>
      </div>
    </div>
  );
}
