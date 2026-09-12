import RegisterClient from './RegisterClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Rishta Account - Jor',
  description: 'Create your Jor Matrimony account with your phone number.',
};

export default function RegisterPage() {
  return <RegisterClient />;
}
