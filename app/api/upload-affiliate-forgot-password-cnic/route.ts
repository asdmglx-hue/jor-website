import { getCloudflareContext } from '@opennextjs/cloudflare';
import { supabase } from '@/lib/supabase';

// Same shape as /api/upload-forgot-password-cnic, but for the affiliate
// forgot-password flow — identified by referral code instead of CNIC
// number, since that's how affiliates are looked up. Still only ever
// needs a single front photo, same as the regular user flow.

const PUBLIC_R2_BASE = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';
const SITE_URL = 'https://joronline.com';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no ambiguous 0/O/1/l/I

function randomCode(length = 7): string {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const formData = await request.formData();

    const referralCode = String(formData.get('code') || '').trim().toUpperCase();
    if (!referralCode) {
      return jsonResponse({ error: 'Referral code is required' }, 400);
    }

    const front = formData.get('front');
    if (!(front instanceof File)) {
      return jsonResponse({ error: 'CNIC front photo is required' }, 400);
    }
    if (!ALLOWED_TYPES.includes(front.type)) {
      return jsonResponse({ error: 'Invalid file type for CNIC photo' }, 400);
    }
    if (front.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: 'CNIC photo is too large (max 8MB)' }, 400);
    }

    const ext = front.type === 'image/png' ? 'png' : front.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `affiliates/forgot-password/${referralCode}/cnic_front_${Date.now()}.${ext}`;
    const bytes = await front.arrayBuffer();

    // @ts-expect-error — CNIC_BUCKET is a Cloudflare R2 binding, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    await env.CNIC_BUCKET.put(objectPath, bytes, {
      httpMetadata: { contentType: front.type },
    });

    const fullUrl = `${PUBLIC_R2_BASE}/${objectPath}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const code = randomCode();
      const { error: insertError } = await supabase.from('image_links').insert({ code, target_url: fullUrl });
      if (!insertError) {
        return jsonResponse({ url: `${SITE_URL}/i/${code}` }, 200);
      }
    }

    return jsonResponse({ url: fullUrl }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Upload failed. Please try again.' }, 500);
  }
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
