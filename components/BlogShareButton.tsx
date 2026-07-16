'use client';

export default function BlogShareButton({ title, slug }: { title: string; slug: string }) {
  const url = `https://joronline.com/blog/${slug}`;
  const text = `${title}\n${url}`;

  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '11px 20px', borderRadius: 12, background: '#EEEDFE', color: '#534AB7',
        fontWeight: 700, fontSize: 13.5, textDecoration: 'none',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.01 2C6.48 2 2 6.48 2 12.01c0 1.87.5 3.63 1.44 5.17L2 22l4.94-1.4a9.96 9.96 0 0 0 5.07 1.39h.01c5.52 0 10-4.48 10-10S17.53 2 12.01 2zm5.85 14.16c-.25.7-1.45 1.34-2 1.42-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.91-4.26-5.06-4.46-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.8-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.25.6.85 2.06.92 2.21.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.31.4-.45.54-.15.15-.3.31-.13.61.17.3.77 1.27 1.65 2.06 1.13 1.01 2.09 1.32 2.39 1.47.3.15.47.13.65-.08.18-.2.76-.89.96-1.19.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.08.13.08.7-.17 1.4z"/>
      </svg>
      Share this post
    </a>
  );
}
