// ─────────────────────────────────────────────────────────────────────────
// This Worker does exactly two things:
//   1. If the request is a POST to /api/upload-cnic, it uploads the two
//      CNIC photos straight to the "proposal-photos" R2 bucket using the
//      CNIC_BUCKET binding below — no access keys or secrets appear
//      anywhere in this file. The binding itself is how Cloudflare grants
//      access; it's configured in wrangler.jsonc and never exposed to the
//      browser.
//   2. Everything else is passed straight through to the static site
//      (env.ASSETS), unchanged — this does not affect normal page loads.
// ─────────────────────────────────────────────────────────────────────────

const PUBLIC_R2_BASE = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per photo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/upload-cnic' && request.method === 'POST') {
      return handleCnicUpload(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleCnicUpload(request, env) {
  try {
    const formData = await request.formData();

    const cnicDigits = String(formData.get('cnic') || '').replace(/\D/g, '');
    if (!/^\d{13}$/.test(cnicDigits)) {
      return jsonResponse({ error: 'Invalid CNIC number' }, 400);
    }

    const front = formData.get('front');
    const back = formData.get('back');
    if (!(front instanceof File) || !(back instanceof File)) {
      return jsonResponse({ error: 'Both CNIC front and back photos are required' }, 400);
    }

    const uploaded = {};
    for (const [key, file] of [['front', front], ['back', back]]) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return jsonResponse({ error: `Invalid file type for CNIC ${key} photo` }, 400);
      }
      if (file.size > MAX_FILE_BYTES) {
        return jsonResponse({ error: `CNIC ${key} photo is too large (max 8MB)` }, 400);
      }

      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const objectPath = `proposals/${cnicDigits}/cnic_${key}_${Date.now()}.${ext}`;
      const bytes = await file.arrayBuffer();

      await env.CNIC_BUCKET.put(objectPath, bytes, {
        httpMetadata: { contentType: file.type },
      });

      uploaded[key] = `${PUBLIC_R2_BASE}/${objectPath}`;
    }

    return jsonResponse(uploaded, 200);
  } catch (err) {
    return jsonResponse({ error: 'Upload failed. Please try again.' }, 500);
  }
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
