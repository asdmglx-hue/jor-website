import type { Metadata } from 'next';
import LoginClientV2 from './LoginClientV2';

export const metadata: Metadata = {
  title: 'Login | Jor',
  description: 'Login to your Jor account to manage your proposal.',
};

export default function LoginPage() {
  return <LoginClientV2 />;
}
