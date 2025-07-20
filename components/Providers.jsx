'use client';

import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { CustomThemeProvider, useTheme } from '@/contexts/ThemeContext';

function AppTheme({ children }) {
  const { darkMode } = useTheme();
  
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: darkMode ? '#90caf9' : '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
      ...(darkMode && {
        background: {
          default: '#121212',
          paper: '#1e1e1e',
        },
      }),
    },
  });

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

export default function Providers({ children }) {
  return (
    <CustomThemeProvider>
      <AppTheme>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <OrganizationProvider>{children}</OrganizationProvider>
        </LocalizationProvider>
      </AppTheme>
    </CustomThemeProvider>
  );
}
