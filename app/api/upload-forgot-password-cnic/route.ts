import { getCloudflareContext } from '@opennextjs/cloudflare';
import { supabase } from '@/lib/supabase';

// Same R2 bucket and validation rules as /api/upload-cnic, but this is a
// separate endpoint deliberately kept independent from the registration
// upload flow — the forgot-password case only ever needs a single front
// photo (to let admin visually verify identity before resetting a
// password), never a back photo, and shouldn't share failure modes with
// account registration.

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

    const cnicDigits = String(formData.get('cnic') || '').replace(/\D/g, '');
    if (!/^\d{13}$/.test(cnicDigits)) {
      return jsonResponse({ error: 'Invalid CNIC number' }, 400);
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
    const objectPath = `forgot-password/${cnicDigits}/cnic_front_${Date.now()}.${ext}`;
    const bytes = await front.arrayBuffer();

    // @ts-expect-error — CNIC_BUCKET is a Cloudflare R2 binding, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    await env.CNIC_BUCKET.put(objectPath, bytes, {
      httpMetadata: { contentType: front.type },
    });

    const fullUrl = `${PUBLIC_R2_BASE}/${objectPath}`;

    // Shorten to a joronline.com link instead of handing admin a long raw
    // R2 URL over WhatsApp — retries a couple of times on the astronomically
    // unlikely chance of a code collision, then just falls back to the full
    // URL rather than failing the whole upload over a cosmetic feature.
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
