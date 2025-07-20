'use client';

import React, { Component } from 'react';
import { Alert, AlertTitle } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';

class OrganizationErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Organization context error:', error, errorInfo);
    
    // Log error for monitoring
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: `Organization context error: ${error.message}`,
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Force a page refresh to reset the organization context
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="50vh"
          p={3}
        >
          <Alert 
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={this.handleRetry}
                startIcon={<RefreshIcon />}
              >
                Retry
              </Button>
            }
          >
            <AlertTitle>Organization Loading Error</AlertTitle>
            There was a problem loading your organization data. This may be due to a temporary network issue or server problem.
            
            <Box mt={2}>
              <strong>What you can try:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Click the "Retry" button to refresh the page</li>
                <li>Check your internet connection</li>
                <li>Try signing out and signing back in</li>
              </ul>
            </Box>
            
            {this.state.error && (
              <Box mt={2} fontSize="0.875rem" color="text.secondary">
                Error details: {typeof this.state.error.message === 'string' ? this.state.error.message : String(this.state.error)}
              </Box>
            )}
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default OrganizationErrorBoundary;