import localFont from 'next/font/local';
import './globals.css';
import NavBar from '../components/NavBar';
import Providers from '../components/Providers';
import HelpWidget from '../components/HelpWidget';

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
  title: 'Alert24 - Incident Management Platform',
  description: 'Comprehensive incident management, monitoring, and team coordination platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <NavBar />
          {children}
          <HelpWidget />
        </Providers>
      </body>
    </html>
  );
}
