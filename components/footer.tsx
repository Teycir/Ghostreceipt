'use client';

const links = [
  { label: 'How to Use', href: '/docs/how-to-use.html' },
  { label: 'FAQ',        href: '/docs/faq.html' },
  { label: 'Security',   href: '/docs/security.html' },
  { label: 'License',    href: '/docs/license.html' },
  { label: 'Made by Teycir', href: 'https://teycirbensoltane.tn', external: true },
];

export function Footer(): React.JSX.Element {
  return (
    <footer
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px 16px',
        fontSize: 'clamp(11px, 2.5vw, 12px)',
        color: 'rgba(255, 255, 255, 0.45)',
        padding: '10px 20px',
        background: 'linear-gradient(to top, rgba(4, 6, 15, 0.97) 0%, rgba(4, 6, 15, 0.7) 70%, transparent 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 100,
      }}
    >
      {links.map((link, i) => (
        <span key={link.href} style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
          <a
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            style={{
              color: 'rgba(255, 255, 255, 0.45)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            {link.label}
          </a>
          {i < links.length - 1 && (
            <span style={{ color: 'rgba(255,255,255,0.2)', userSelect: 'none' }}>•</span>
          )}
        </span>
      ))}
    </footer>
  );
}
