import './globals.css';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import NavBar from '@/components/NavBar';
import HelpWidget from '@/components/HelpWidget';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

export const metadata = {
  title: 'Alert24',
  description: 'Real-time monitoring and alerting platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
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
        </ThemeProvider>
      </body>
    </html>
  );
}
