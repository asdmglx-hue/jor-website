import { getCloudflareContext } from '@opennextjs/cloudflare';
import { supabase } from '@/lib/supabase';

const PUBLIC_R2_BASE = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';
const SITE_URL = 'https://joronline.com';
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function randomCode(length = 7): string {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const formData = await request.formData();

    const authPhone = String(formData.get('auth_phone') || '').trim();
    const identity = authPhone.replace(/\D/g, '');
    if (!identity || identity.length < 7) {
      return jsonResponse({ error: 'Invalid phone number' }, 400);
    }

    const receipt = formData.get('receipt');
    if (!(receipt instanceof File)) {
      return jsonResponse({ error: 'Payment receipt is required' }, 400);
    }
    if (!ALLOWED_TYPES.includes(receipt.type)) {
      return jsonResponse({ error: 'Invalid file type for payment receipt' }, 400);
    }
    if (receipt.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: 'Receipt image is too large (max 8MB)' }, 400);
    }

    const ext = receipt.type === 'image/png' ? 'png' : receipt.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `payment-proofs/${identity}/proof_${Date.now()}.${ext}`;
    const bytes = await receipt.arrayBuffer();

    // @ts-expect-error — CNIC_BUCKET is a Cloudflare R2 binding
    await env.CNIC_BUCKET.put(objectPath, bytes, {
      httpMetadata: { contentType: receipt.type },
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
