import { getCloudflareContext } from '@opennextjs/cloudflare';

const PUBLIC_R2_BASE = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';
const WATERMARK_URL = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev/assets/watermark-bar.png';
const MAX_FILE_BYTES = 8 * 1024 * 1024;
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

    const objectPath = `proposals/${cnicDigits}/profile_${Date.now()}.jpg`;
    let finalBytes: ArrayBuffer;

    if (env.IMAGES) {
      try {
        // Fetch the watermark from R2 — no CORS issues here since this runs
        // server-side on Cloudflare Workers, not in the visitor's browser.
        const wmResponse = await fetch(WATERMARK_URL);
        if (!wmResponse.ok) throw new Error('watermark fetch failed');

        const photoBytes = await photo.arrayBuffer();

        // Composite watermark bar across the full bottom of the photo using
        // Cloudflare's official Images binding API. The watermark bar PNG is
        // 2000×123px — width:1 (100% of base width) scales it to fill the
        // full width of any photo; bottom:0 pins it flush to the bottom edge.
        const output = await env.IMAGES
          .input(photoBytes)
          .draw(
            env.IMAGES.input(wmResponse.body).transform({ width: 1, fit: 'scale-down' }),
            { bottom: 0, left: 0, right: 0 }
          )
          .output({ format: 'image/jpeg', quality: 90 });

        finalBytes = await output.response().then((r: Response) => r.arrayBuffer());
      } catch (_) {
        // Watermarking failed — fall back to original photo so the upload
        // never gets blocked. This matches the mobile app's same fallback.
        finalBytes = await photo.arrayBuffer();
      }
    } else {
      // IMAGES binding not available in local dev — upload original
      finalBytes = await photo.arrayBuffer();
    }

    // @ts-expect-error — CNIC_BUCKET is a Cloudflare R2 binding, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    await env.CNIC_BUCKET.put(objectPath, finalBytes, {
      httpMetadata: { contentType: 'image/jpeg' },
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
