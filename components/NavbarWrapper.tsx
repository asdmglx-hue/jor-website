'use client';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function NavbarWrapper() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  return (
    <>
      <Navbar sticky={isHome} />
      {/* Spacer to push content below fixed navbar on homepage */}
      {isHome && <div style={{ height: 60 }} />}
    </>
  );
}
