import LoginOtpClient from './LoginOtpClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login — Jor Matrimony',
  description: 'Login to your Jor Matrimony account with your phone number.',
  robots: { index: false, follow: false }, // don't index the clone
};

export default function LoginOtpPage() {
  return <LoginOtpClient />;
}
