import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto', padding: '80px 20px', textAlign: 'center', overflow: 'hidden' }}>
      <img
        src="/ring-404.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', top: '54%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 300, height: 'auto', opacity: 0.08, pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 64, fontWeight: 900, color: '#534AB7', marginBottom: 8 }}>404</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1830', marginBottom: 12 }}>
          We couldn&apos;t find that page
        </h1>
        <p style={{ fontSize: 15, color: '#6B6893', marginBottom: 32, lineHeight: 1.6 }}>
          The link you followed may be broken, or the profile may no longer be available.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{
            display: 'inline-block', padding: '13px 28px', borderRadius: 12,
            background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none',
          }}>
            Back to Home
          </Link>
          <Link href="/proposals" style={{
            display: 'inline-block', padding: '13px 28px', borderRadius: 12,
            background: '#fff', border: '1.5px solid #E8E6F5', color: '#534AB7', fontWeight: 800, fontSize: 14, textDecoration: 'none',
          }}>
            Browse Proposals
          </Link>
        </div>
      </div>
    </div>
  );
}
