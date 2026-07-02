import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'Login | Jor',
  description: 'Login to your Jor account to manage your proposal.',
};

export default function LoginPage() {
  return <LoginClient />;
}
