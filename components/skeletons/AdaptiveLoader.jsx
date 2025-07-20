import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import AnalyticsCardSkeleton from './AnalyticsCardSkeleton';
import ChartSkeleton from './ChartSkeleton';
import ProgressiveLoader from './ProgressiveLoader';

const AdaptiveLoader = ({ 
  type = 'auto',
  complexity = 'medium',
  estimatedLoadTime,
  onLoadComplete,
  children,
  ...props 
}) => {
  const [loadingType, setLoadingType] = useState(type);
  const [startTime] = useState(Date.now());

  // Auto-detect loading type based on estimated time or complexity
  useEffect(() => {
    if (type === 'auto') {
      const estimatedTime = estimatedLoadTime || getEstimatedTimeFromComplexity(complexity);
      
      if (estimatedTime < 1000) {
        setLoadingType('spinner');
      } else if (estimatedTime < 5000) {
        setLoadingType('skeleton');
      } else {
        setLoadingType('progressive');
      }
    }
  }, [type, complexity, estimatedLoadTime]);

  const getEstimatedTimeFromComplexity = (complexity) => {
    switch (complexity) {
      case 'simple': return 800;
      case 'medium': return 2500;
      case 'complex': return 6000;
      default: return 2500;
    }
  };

  const getProgressiveStages = (complexity) => {
    switch (complexity) {
      case 'simple':
        return ['Loading...'];
      case 'medium':
        return ['Loading data...', 'Processing...'];
      case 'complex':
        return ['Fetching data...', 'Processing analytics...', 'Rendering charts...', 'Finalizing...'];
      default:
        return ['Loading data...', 'Processing...'];
    }
  };

  const renderLoader = () => {
    const estimatedTime = estimatedLoadTime || getEstimatedTimeFromComplexity(complexity);

    switch (loadingType) {
      case 'spinner':
        return (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 100,
              p: 2
            }}
            role="status"
            aria-label="Loading"
          >
            <CircularProgress size={32} />
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ mt: 1 }}
              aria-live="polite"
            >
              Loading...
            </Typography>
          </Box>
        );

      case 'skeleton':
        const { variant = 'default', chartType, showTitle } = props;
        
        if (variant === 'chart' || chartType) {
          return (
            <ChartSkeleton 
              type={chartType || 'bar'} 
              showTitle={showTitle !== false}
              {...props} 
            />
          );
        }
        
        return (
          <AnalyticsCardSkeleton 
            variant={variant}
            {...props}
          />
        );

      case 'progressive':
        return (
          <ProgressiveLoader
            stages={getProgressiveStages(complexity)}
            estimatedTime={estimatedTime}
            onComplete={onLoadComplete}
          >
            {children}
          </ProgressiveLoader>
        );

      default:
        return (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 100 
            }}
          >
            <CircularProgress />
          </Box>
        );
    }
  };

  return (
    <Box
      sx={{
        transition: 'all 0.3s ease-in-out',
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '& *': {
            animationDuration: '0.01s !important',
            animationIterationCount: '1 !important',
          }
        }
      }}
    >
      {renderLoader()}
    </Box>
  );
};

export default AdaptiveLoader;