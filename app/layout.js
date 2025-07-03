import localFont from 'next/font/local';
import './globals.css';
import AuthStatus from '../components/AuthStatus';
import Providers from '../components/Providers';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata = {
  title: 'Alert24 - Multi-tenant SaaS Platform',
  description: 'Organization management and collaboration platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <header style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
            {/* AuthStatus removed to avoid duplicate login forms */}
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
