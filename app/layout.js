import './globals.css';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import ClientThemeProvider from '@/components/ThemeProvider';
import NavBar from '@/components/NavBar';
import HelpWidget from '@/components/HelpWidget';

export const metadata = {
  title: 'Alert24',
  description: 'Real-time monitoring and alerting platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientThemeProvider>
          <OrganizationProvider>
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
            </div>
          </OrganizationProvider>
        </ClientThemeProvider>
      </body>
    </html>
  );
}
