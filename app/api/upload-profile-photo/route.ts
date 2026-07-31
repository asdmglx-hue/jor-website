import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PhotonImage, resize, watermark, SamplingFilter } from '@cf-wasm/photon/workerd';

// Moved here from the old standalone worker.js — same exact validation
// rules, same object path pattern, same response shape.
//
// Watermarking added on top: every uploaded profile photo gets the
// approved "joronline.com" bottom-bar mark burned in before it's ever
// saved to R2, so it can't be bypassed by uploading straight to storage
// the way this specific route works. The watermark bar itself is a
// pre-made transparent PNG (not drawn as live text) — Photon's text
// rendering is a much less battle-tested part of the library, so a
// pre-rendered image resized to fit each photo's width is the more
// reliable choice here. That watermark asset lives at
// assets/watermark-bar.png in this same R2 bucket — a one-time upload,
// not something that changes per-request.
//
// If watermarking fails for any reason (a corrupt upload, a WASM error,
// the asset briefly missing), the original photo still gets saved
// un-watermarked rather than blocking the person's signup — a photo
// without a watermark is a much smaller problem than someone unable to
// create their profile at all.

const PUBLIC_R2_BASE = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';
const WATERMARK_ASSET_PATH = 'assets/watermark-bar.png';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per photo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function applyWatermark(inputBytes: Uint8Array, watermarkBucket: R2Bucket): Promise<Uint8Array | null> {
  let baseImage: PhotonImage | null = null;
  let watermarkImage: PhotonImage | null = null;
  let resizedWatermark: PhotonImage | null = null;
  try {
    const watermarkObj = await watermarkBucket.get(WATERMARK_ASSET_PATH);
    if (!watermarkObj) return null; // asset missing — fall back to unwatermarked rather than fail the upload
    const watermarkBytes = new Uint8Array(await watermarkObj.arrayBuffer());

    baseImage = PhotonImage.new_from_byteslice(inputBytes);
    watermarkImage = PhotonImage.new_from_byteslice(watermarkBytes);

    const baseWidth = baseImage.get_width();
    const baseHeight = baseImage.get_height();
    const wmAspect = watermarkImage.get_height() / watermarkImage.get_width();
    const targetWmWidth = baseWidth;
    const targetWmHeight = Math.max(1, Math.round(targetWmWidth * wmAspect));

    resizedWatermark = resize(watermarkImage, targetWmWidth, targetWmHeight, SamplingFilter.Lanczos3);
    watermark(baseImage, resizedWatermark, 0, baseHeight - targetWmHeight);

    return baseImage.get_bytes_jpeg(88);
  } catch {
    return null; // any failure here — just fall back, don't block the upload
  } finally {
    baseImage?.free();
    watermarkImage?.free();
    resizedWatermark?.free();
  }
}

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

    const originalBytes = new Uint8Array(await photo.arrayBuffer());
    // @ts-expect-error — CNIC_BUCKET is a Cloudflare R2 binding, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    const watermarkedBytes = await applyWatermark(originalBytes, env.CNIC_BUCKET);

    const bytesToSave = watermarkedBytes ?? originalBytes;
    // Watermarking always outputs JPEG (get_bytes_jpeg) — only fall back
    // to the original's own extension/content-type when watermarking
    // didn't run at all.
    const ext = watermarkedBytes ? 'jpg' : (photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg');
    const contentType = watermarkedBytes ? 'image/jpeg' : photo.type;
    const objectPath = `proposals/${cnicDigits}/profile_${Date.now()}.${ext}`;

    // @ts-expect-error — CNIC_BUCKET is a Cloudflare R2 binding, typed via cloudflare-env.d.ts after running `npm run cf-typegen`
    await env.CNIC_BUCKET.put(objectPath, bytesToSave, {
      httpMetadata: { contentType },
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
