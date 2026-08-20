import { NextResponse } from 'next/server';

export async function GET() {
  // 301 permanent — Google stops re-crawling this URL and transfers all
  // link equity to the Play Store page directly.
  return NextResponse.redirect('https://play.google.com/store/apps/details?id=com.joronline.jor', 301);
}
