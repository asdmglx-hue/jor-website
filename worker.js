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

// These two are the actual destinations your QR codes/footer links point
// to. Right now they show a "coming soon" page since the app isn't
// published yet. Once your app IS live, just replace the two
// Response("...") blocks below (in the /get-ios and /get-android checks)
// with:
//   return Response.redirect('https://apps.apple.com/app/idXXXXXXXXXX', 302);
//   return Response.redirect('https://play.google.com/store/apps/details?id=your.package.name', 302);
// Every QR code, footer link, and printed material that already points to
// /get-ios or /get-android keeps working with zero changes needed anywhere
// else.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/get-ios' || url.pathname === '/get-android') {
      return comingSoonResponse(url.pathname === '/get-ios' ? 'iOS' : 'Android');
    }

    if (url.pathname === '/api/upload-cnic' && request.method === 'POST') {
      return handleCnicUpload(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

function comingSoonResponse(platform) {
  const storeName = platform === 'iOS' ? 'the App Store' : 'Google Play';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coming Soon - Joron</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .card { max-width: 420px; }
    h1 { font-size: 1.6rem; margin-bottom: 12px; }
    p { color: #aaa; line-height: 1.5; margin-bottom: 24px; }
    a {
      display: inline-block;
      background: #fff;
      color: #0a0a0a;
      padding: 12px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${platform} app is on its way 🚀</h1>
    <p>We're putting the finishing touches on the Joron app for ${storeName}. Check back soon — or visit our site in the meantime.</p>
    <a href="https://joronline.com">Visit joronline.com</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    status: 200,
  });
}

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
