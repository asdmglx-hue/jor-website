import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Resolves short links like joronline.com/i/aB3dK9 (created by the
// forgot-password CNIC upload flow) to their real target URL — currently
// only used for R2-hosted photos, but written generically enough to reuse
// for any future "give admin a short link instead of a long one" need.
export default async function ShortLinkRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { data } = await supabase.from('image_links').select('target_url').eq('code', code).maybeSingle();

  if (!data?.target_url) {
    redirect('/');
  }

  redirect(data.target_url);
}
