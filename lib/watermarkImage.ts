// Draws the "joronline.com" watermark bar onto a profile photo entirely
// in the visitor's browser, using nothing but the standard Canvas API —
// no external library, no WASM, no bundler-specific setup. This exists
// specifically because a much more complex server-side approach (running
// a WASM image library inside a Cloudflare Worker) turned out to be
// unreliable across every build tool we tried it with. This version has
// no such moving parts: canvas and image loading have been standard,
// boring, reliable browser features for well over a decade.
//
// If anything at all goes wrong here — the watermark image fails to
// load, canvas throws, whatever — this falls back to returning the
// original, un-watermarked file rather than blocking the person's
// upload. A missing watermark on an occasional photo is a small
// problem; someone unable to finish creating their profile is not.

const WATERMARK_URL = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev/assets/watermark-bar.png';

let cachedWatermark: Promise<ImageBitmap> | null = null;

function loadWatermark(): Promise<ImageBitmap> {
  if (!cachedWatermark) {
    cachedWatermark = fetch(WATERMARK_URL)
      .then(res => { if (!res.ok) throw new Error('watermark fetch failed'); return res.blob(); })
      .then(blob => createImageBitmap(blob));
  }
  return cachedWatermark;
}

export async function addWatermark(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    const [photoBitmap, watermarkBitmap] = await Promise.all([
      createImageBitmap(file),
      loadWatermark(),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = photoBitmap.width;
    canvas.height = photoBitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(photoBitmap, 0, 0);

    // Scale the watermark bar to match this exact photo's width, keeping
    // its own aspect ratio — the same approach used everywhere else the
    // watermark appears, so it looks consistent regardless of photo size.
    const wmHeight = Math.round(photoBitmap.width * (watermarkBitmap.height / watermarkBitmap.width));
    ctx.drawImage(watermarkBitmap, 0, photoBitmap.height - wmHeight, photoBitmap.width, wmHeight);

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
