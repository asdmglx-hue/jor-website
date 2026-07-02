import { fetchCategoryCounts, fetchProposalsForCategory, MIN_CATEGORY_PROFILES } from '@/lib/supabase';
import { CATEGORY_ENTRIES, resolveCategoryBySlug, categoryPageTitle, CategoryEntry } from '@/lib/categories';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import ProposalCard from '@/components/ProposalCard';

type Props = { params: Promise<{ slug: string }> };

// Only generates a page for a category value that actually has enough
// real profiles behind it (MIN_CATEGORY_PROFILES) — an indexed page with
// almost nothing on it hurts more than it helps, even without being
// combined with other filters.
async function getQualifyingEntries(): Promise<CategoryEntry[]> {
  const [cityCounts, casteCounts, sectCounts, maritalCounts, professionCounts] = await Promise.all([
    fetchCategoryCounts('city'),
    fetchCategoryCounts('caste'),
    fetchCategoryCounts('sect'),
    fetchCategoryCounts('marital_status'),
    fetchCategoryCounts('profession'),
  ]);
  const countsByColumn: Record<string, Record<string, number>> = {
    city: cityCounts, caste: casteCounts, sect: sectCounts, marital_status: maritalCounts, profession: professionCounts,
  };
  return CATEGORY_ENTRIES.filter(e => (countsByColumn[e.dbColumn]?.[e.value] ?? 0) >= MIN_CATEGORY_PROFILES);
}

export async function generateStaticParams() {
  const entries = await getQualifyingEntries();
  return entries.map(e => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = resolveCategoryBySlug(slug);
  if (!entry) return { title: 'Not Found | Jor' };
  const title = categoryPageTitle(entry);
  return {
    title: `${title} | Jor – Pakistan's Trusted Matrimonial Platform`,
    description: entry.type === 'city'
      ? `Browse verified rishta proposals in ${entry.value}. Find your perfect match from ${entry.value} on Jor, Pakistan's trusted matrimonial platform.`
      : `Browse verified ${entry.value} rishta proposals on Jor. Connect directly with families — no middlemen, no hidden fees.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const entry = resolveCategoryBySlug(slug);
  if (!entry) notFound();

  const proposals = await fetchProposalsForCategory(entry.dbColumn as never, entry.value, 24);
  if (proposals.length === 0) notFound();

  const title = categoryPageTitle(entry);
  const searchLink = entry.type === 'city' ? `/proposals?city=${encodeURIComponent(entry.value)}` : `/proposals`;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ fontSize: 13, color: '#B0ADCB', marginBottom: 12 }}>
        <Link href="/" style={{ color: '#534AB7', textDecoration: 'none' }}>Home</Link>
        {' › '}
        <Link href="/proposals" style={{ color: '#534AB7', textDecoration: 'none' }}>Proposals</Link>
        {' › '}
        <span>{entry.value}</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>{title}</h1>
      <p style={{ fontSize: 14, color: '#6B6893', marginBottom: 24 }}>
        {entry.type === 'city'
          ? `Browse verified rishta proposals from ${entry.value}. Connect directly with families across Pakistan.`
          : `Browse verified ${entry.value.toLowerCase()} rishta proposals. Connect directly with families — no middlemen, no hidden fees.`}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {proposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <Link href={searchLink} style={{
          display: 'inline-block', padding: '12px 28px', borderRadius: 12,
          background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none',
        }}>
          View All Proposals & Filter Further →
        </Link>
      </div>
    </div>
  );
}
