import { fetchProposalById, heightDisplay } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import PhotoLightbox from '@/components/PhotoLightbox';
import ContactButtons from '@/components/ContactButtons';
import ShareButton from '@/components/ShareButton';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProposalById(id);
  if (!p) return { title: 'Proposal Not Found | Jor' };
  return {
    title: `${p.gender === 'Male' ? 'Groom' : 'Bride'} Profile – ${p.age} yrs, ${p.city} | Jor`,
    description: `${p.profession}, ${p.education}, ${p.caste} from ${p.city}. ${p.about || ''}`.slice(0, 160),
    openGraph: {
      title: `Rishta Proposal – ${p.age} yrs, ${p.city}`,
      description: `${p.profession} from ${p.city}. ${p.caste}, ${p.sect}.`,
      images: p.profile_photo_url ? [p.profile_photo_url] : [],
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
  const p = await fetchProposalById(id);
  if (!p) notFound();

  const heightFt = p.height_inches ? heightDisplay(p.height_inches) : null;
  const isFeatured = p.subscription_tier === 'featured' || p.is_boosted;


  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
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
            background: isFeatured ? '#FFFBF5' : '#fff',
            border: `1px solid ${isFeatured ? '#E8620A44' : '#E8E6F5'}`,
            borderRadius: 20, padding: '24px', marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              {/* Photo */}
              {p.profile_photo_url ? (
                <PhotoLightbox src={p.profile_photo_url} name={p.name} />
              ) : (
                <div style={{
                  width: 100, height: 100, borderRadius: 16, flexShrink: 0,
                  background: p.gender === 'Male' ? '#534AB7' : '#E11D48',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, color: '#fff', fontWeight: 900,
                }}>
                  {p.name.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1830', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </h1>
                  {isFeatured && (
                    <span style={{ background: '#E8620A', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, letterSpacing: 0.5, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z"/></svg>
                      FEATURED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#6B6893', lineHeight: 1.7 }}>
                  <div>{p.age} yrs • {p.country && p.country !== 'Pakistan' ? `${p.country} (from ${p.city})` : p.city}</div>
                  <div>{p.caste} • {p.sect}</div>
                  <div>{p.profession}</div>
                </div>
              </div>
            </div>
          </div>

          {/* About */}
          {(p.about || p.looking_for) && (
            <Section title="About">
              {p.about && <p style={{ fontSize: 14, color: '#1A1830', lineHeight: 1.7, marginBottom: p.looking_for ? 12 : 0 }}>{p.about}</p>}
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
            <InfoRow icon="" label="Practice Level" value={p.practice_level} />
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

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F5F5F5' }}>
              <div style={{ fontSize: 12, color: '#B0ADCB', marginBottom: 8 }}>Posted</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6B6893' }}>
                {new Date(p.posted_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 12, color: '#B0ADCB', marginTop: 4 }}>Proposal #{p.proposal_number}</div>
            </div>
          </div>

          {/* Share */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <ShareButton p={p} />
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
