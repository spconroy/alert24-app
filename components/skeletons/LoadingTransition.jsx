import React, { useState, useEffect } from 'react';
import { Box, Fade, Grow } from '@mui/material';
import AdaptiveLoader from './AdaptiveLoader';
import AccessibleLoadingAnnouncer from './AccessibleLoadingAnnouncer';

const LoadingTransition = ({ 
  loading, 
  children, 
  transitionType = 'fade',
  duration = 300,
  loaderProps = {},
  preventLayoutShift = true,
  loadingMessage = 'Loading content',
  completedMessage = 'Content loaded successfully',
  ...props 
}) => {
  const [showLoader, setShowLoader] = useState(loading);
  const [showContent, setShowContent] = useState(!loading);
  const [dimensions, setDimensions] = useState(null);

  // Track dimensions to prevent layout shift
  useEffect(() => {
    if (preventLayoutShift && !loading && children) {
      // Capture dimensions when content first loads
      const timer = setTimeout(() => {
        const element = document.querySelector('[data-loading-container]');
        if (element) {
          setDimensions({
            width: element.offsetWidth,
            height: element.offsetHeight
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, children, preventLayoutShift]);

  useEffect(() => {
    if (loading) {
      setShowContent(false);
      setShowLoader(true);
    } else {
      // Delay hiding loader to allow content to render
      const timer = setTimeout(() => {
        setShowLoader(false);
        setShowContent(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const TransitionComponent = transitionType === 'grow' ? Grow : Fade;

  const containerStyle = {
    position: 'relative',
    ...(preventLayoutShift && dimensions && {
      minWidth: dimensions.width,
      minHeight: dimensions.height
    }),
    ...props.sx
  };

  return (
    <AccessibleLoadingAnnouncer
      isLoading={loading}
      loadingMessage={loadingMessage}
      completedMessage={completedMessage}
    >
      <Box sx={containerStyle} data-loading-container {...props}>
        {showLoader && (
          <TransitionComponent in={loading} timeout={duration}>
            <Box sx={{ 
              position: preventLayoutShift ? 'absolute' : 'static',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1
            }}>
              <AdaptiveLoader {...loaderProps} />
            </Box>
          </TransitionComponent>
        )}
        
        {showContent && (
          <TransitionComponent in={!loading} timeout={duration}>
            <Box sx={{ 
              opacity: showLoader ? 0 : 1,
              transition: `opacity ${duration}ms ease-in-out`,
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none'
              }
            }}>
              {children}
            </Box>
          </TransitionComponent>
        )}
      </Box>
    </AccessibleLoadingAnnouncer>
  );
};

export default LoadingTransition;