import { comingSoonResponse } from '@/lib/comingSoon';

// Moved here from the old standalone worker.js. Once the app is actually
// published, replace this with:
//   import { NextResponse } from 'next/server';
//   export async function GET() {
//     return NextResponse.redirect('https://apps.apple.com/app/idXXXXXXXXXX', 302);
//   }
// Every QR code and footer link already pointing to /get-ios keeps
// working with zero changes needed anywhere else.
export async function GET() {
  return comingSoonResponse('iOS');
}
