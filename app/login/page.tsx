import LoginClient from './LoginClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login to Your Account - Jor',
  description: 'Login to your Jor Matrimony account with your phone number.',
};

export default function LoginPage() {
  return <LoginClient />;
}
