import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// Called by the admin app whenever a footer-relevant setting changes
// (affiliate enabled, help center enabled, help center name, whatsapp number).
// Invalidates the layout cache immediately so the next visitor sees the
// updated footer — no waiting on a fixed revalidate interval.
//
// The token is stored in your Supabase app_settings table under the key
// 'revalidate_token' (set there so the admin app can read it using its
// existing Supabase connection, without needing a separate secret store).
// This endpoint reads it from the REVALIDATE_TOKEN environment variable,
// which should be set in your Cloudflare Pages environment variables to
// match that same value:
//   Jqz62p0xR_cacUBSLPgoqurzywcNffWqQbnjmsVgdf4
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, path } = body as { token?: string; path?: string };
  const expected = process.env.REVALIDATE_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (path) {
    // Revalidate a specific path (e.g. /profile/1234)
    revalidatePath(path);
  } else {
    // Revalidate every page since the footer appears on all of them.
    revalidatePath('/', 'layout');
  }

  return NextResponse.json({ revalidated: true, path: path ?? '/' });
}
