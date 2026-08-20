import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'Login | Jor',
  description: 'Login to your Jor account to manage your proposal.',
  // Already blocked in robots.txt but belt-and-suspenders: if Google
  // somehow gets here, the meta tag is the stronger, per-page signal.
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginClient />;
}
