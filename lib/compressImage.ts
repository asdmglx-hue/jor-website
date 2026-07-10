// Compresses and resizes an image entirely in the visitor's browser before
// it's ever uploaded. This matters specifically for Cloudflare Workers CPU
// time: parsing a large multipart file upload (phone camera photos can be
// 5-8MB) costs real, billable CPU time on the server, whereas resizing in
// the browser costs the *visitor's* device, not the Worker. A typical phone
// photo compressed this way drops from several MB to a few hundred KB —
// faster uploads for users on slow connections too, not just cheaper for us.
export async function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  // Skip compression for types canvas can't reliably re-encode, or if
  // something goes wrong — better to upload the original than fail the
  // whole submission over an optimization.
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;

    // Only use the compressed version if it's actually smaller — a tiny
    // already-optimized image could theoretically grow slightly after
    // re-encoding to JPEG, so fall back to the original in that case.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
