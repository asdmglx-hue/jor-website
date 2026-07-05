export function comingSoonResponse(platform: 'iOS' | 'Android') {
  const storeName = platform === 'iOS' ? 'the App Store' : 'Google Play';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coming Soon | Jor</title>
  <link rel="icon" href="https://joronline.com/favicon.png">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #534AB7 0%, #3D35A0 50%, #0F6E56 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
    }
    .card {
      max-width: 420px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 20px;
      padding: 40px 32px;
      backdrop-filter: blur(6px);
    }
    .card img { display: block; margin: 0 auto 20px; }
    .badge {
      display: block; width: fit-content; margin: 0 auto 18px; background: rgba(255,255,255,0.15); border-radius: 20px;
      padding: 5px 14px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 12px; line-height: 1.3; }
    p { color: rgba(255,255,255,0.8); line-height: 1.6; margin: 0 0 28px; font-size: 15px; }
    a {
      display: inline-block;
      background: #fff;
      color: #534AB7;
      padding: 13px 30px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="https://joronline.com/logo-white.png" alt="Jor" style="height: 40px; width: auto;" />
    <div class="badge">${platform} App</div>
    <h1>We're putting the finishing touches on it 🚀</h1>
    <p>The Jor app is on its way to ${storeName}. In the meantime, you can browse rishta proposals and manage everything right from our website.</p>
    <a href="https://joronline.com">Visit joronline.com</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    status: 200,
  });
}
