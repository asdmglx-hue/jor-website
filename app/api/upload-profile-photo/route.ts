import { getCloudflareContext } from '@opennextjs/cloudflare';

// Moved here from the old standalone worker.js — same exact validation
// rules, same object path pattern, same response shape.

const PUBLIC_R2_BASE = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per photo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const formData = await request.formData();

    const cnicDigits = String(formData.get('cnic') || '').replace(/\D/g, '');
    if (!/^\d{13}$/.test(cnicDigits)) {
      return jsonResponse({ error: 'Invalid CNIC number' }, 400);
    }

    const photo = formData.get('photo');
    if (!(photo instanceof File)) {
      return jsonResponse({ error: 'Profile photo is required' }, 400);
    }
    if (!ALLOWED_TYPES.includes(photo.type)) {
      return jsonResponse({ error: 'Invalid file type for profile photo' }, 400);
    }
    if (photo.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: 'Profile photo is too large (max 8MB)' }, 400);
    }

    const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `proposals/${cnicDigits}/profile_${Date.now()}.${ext}`;
    const bytes = await photo.arrayBuffer();

    // @ts-expect-error — CNIC_BUCKET is a Cloudflare R2 binding, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    await env.CNIC_BUCKET.put(objectPath, bytes, {
      httpMetadata: { contentType: photo.type },
    });

    return jsonResponse({ url: `${PUBLIC_R2_BASE}/${objectPath}` }, 200);
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
