import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'A Fábrica',
  description: 'Painel de uso individual para acompanhar e comandar as fábricas de agentes.',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#05060a'
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <head>
        {/* Manrope e JetBrains Mono, as duas famílias de tokens.json. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Manrope:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body>
        <div id="raiz" className="gf-root gf-ambient">
          {children}
        </div>
      </body>
    </html>
  );
}
