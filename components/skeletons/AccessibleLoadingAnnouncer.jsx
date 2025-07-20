import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';

const AccessibleLoadingAnnouncer = ({ 
  isLoading, 
  loadingMessage = 'Loading content',
  completedMessage = 'Content loaded',
  progressMessage = '',
  children 
}) => {
  const [announceMessage, setAnnounceMessage] = useState('');
  const [lastProgress, setLastProgress] = useState('');

  useEffect(() => {
    if (isLoading && announceMessage !== loadingMessage) {
      setAnnounceMessage(loadingMessage);
    } else if (!isLoading && announceMessage !== completedMessage) {
      setAnnounceMessage(completedMessage);
    }
  }, [isLoading, loadingMessage, completedMessage, announceMessage]);

  useEffect(() => {
    if (progressMessage && progressMessage !== lastProgress) {
      setAnnounceMessage(progressMessage);
      setLastProgress(progressMessage);
    }
  }, [progressMessage, lastProgress]);

  return (
    <>
      {/* Screen reader announcement area */}
      <Box
        component="div"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {announceMessage}
      </Box>
      
      {/* Assertive announcements for critical updates */}
      <Box
        component="div"
        aria-live="assertive"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {!isLoading ? completedMessage : ''}
      </Box>

      {/* Main content */}
      <Box
        role={isLoading ? 'status' : undefined}
        aria-busy={isLoading}
        aria-label={isLoading ? loadingMessage : undefined}
      >
        {children}
      </Box>
    </>
  );
};

export default AccessibleLoadingAnnouncer;