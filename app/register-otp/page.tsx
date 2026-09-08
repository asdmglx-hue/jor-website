import RegisterOtpClient from './RegisterOtpClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account — Jor Matrimony',
  description: 'Create your Jor Matrimony account with your phone number.',
  robots: { index: false, follow: false },
};

export default function RegisterOtpPage() {
  return <RegisterOtpClient />;
}
