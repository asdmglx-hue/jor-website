import { getCloudflareContext } from '@opennextjs/cloudflare';

// Modeled directly on /api/upload-cnic — same bucket, same validation
// rules, same response shape. The only real difference: this accepts a
// `slot` (1, 2, or 3) instead of a fixed front/back pair, since a profile
// can have up to three separate degrees, each with its own optional
// certificate photo.

const PUBLIC_R2_BASE = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const formData = await request.formData();

    const cnicDigits = String(formData.get('cnic') || '').replace(/\D/g, '');
    if (!/^\d{13}$/.test(cnicDigits)) {
      return jsonResponse({ error: 'Invalid CNIC number' }, 400);
    }

    const slot = String(formData.get('slot') || '');
    if (!['1', '2', '3'].includes(slot)) {
      return jsonResponse({ error: 'Invalid degree slot' }, 400);
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return jsonResponse({ error: 'No file provided' }, 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonResponse({ error: 'Invalid file type — use JPG, PNG, or WEBP' }, 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: 'File is too large (max 8MB)' }, 400);
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `proposals/${cnicDigits}/degree_certificate_${slot}_${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    // @ts-expect-error — CNIC_BUCKET is a Cloudflare R2 binding, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    await env.CNIC_BUCKET.put(objectPath, bytes, {
      httpMetadata: { contentType: file.type },
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
