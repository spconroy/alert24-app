import './globals.css';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import ClientThemeProvider from '@/components/ThemeProvider';
import Providers from '@/components/Providers';
import NavBar from '@/components/NavBar';
import HelpWidget from '@/components/HelpWidget';
import OrganizationErrorBoundary from '@/components/OrganizationErrorBoundary';
import OrganizationNotifications from '@/components/OrganizationNotifications';

export const metadata = {
  title: 'Alert24',
  description: 'Real-time monitoring and alerting platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline' 'unsafe-eval';" />
      </head>
      <body suppressHydrationWarning={true}>
        <Providers>
          <OrganizationErrorBoundary>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
              }}
            >
              <NavBar />
              <main style={{ flex: 1, padding: '20px' }}>{children}</main>
              <HelpWidget />
              <OrganizationNotifications />
            </div>
          </OrganizationErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
