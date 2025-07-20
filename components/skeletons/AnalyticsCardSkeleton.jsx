import React from 'react';
import { Paper, Box } from '@mui/material';

const shimmerKeyframes = `
  @keyframes shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: calc(200px + 100%) 0;
    }
  }
`;

const AnalyticsCardSkeleton = ({ variant = 'default', count = 1 }) => {
  const skeletonStyle = {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200px 100%',
    animation: 'shimmer 1.5s infinite linear',
    borderRadius: 1,
  };

  const renderCardSkeleton = () => {
    switch (variant) {
      case 'metric':
        return (
          <Paper sx={{ p: 2, height: 140 }}>
            <style>{shimmerKeyframes}</style>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ ...skeletonStyle, height: 16, width: '70%' }} />
              <Box sx={{ ...skeletonStyle, height: 32, width: '50%' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ ...skeletonStyle, height: 12, width: 12, borderRadius: '50%' }} />
                <Box sx={{ ...skeletonStyle, height: 12, width: '40%' }} />
              </Box>
            </Box>
          </Paper>
        );
      
      case 'chart':
        return (
          <Paper sx={{ p: 2, height: 300 }}>
            <style>{shimmerKeyframes}</style>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ ...skeletonStyle, height: 20, width: '60%' }} />
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...Array(5)].map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'end', gap: 0.5, height: 40 }}>
                    {[...Array(7)].map((_, j) => (
                      <Box 
                        key={j} 
                        sx={{ 
                          ...skeletonStyle, 
                          width: 20, 
                          height: `${Math.random() * 30 + 10}px`,
                          flexShrink: 0
                        }} 
                      />
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        );
      
      case 'table':
        return (
          <Paper sx={{ p: 2, height: 400 }}>
            <style>{shimmerKeyframes}</style>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ ...skeletonStyle, height: 20, width: '50%' }} />
              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                <Box sx={{ ...skeletonStyle, height: 16, width: '25%' }} />
                <Box sx={{ ...skeletonStyle, height: 16, width: '20%' }} />
                <Box sx={{ ...skeletonStyle, height: 16, width: '25%' }} />
                <Box sx={{ ...skeletonStyle, height: 16, width: '30%' }} />
              </Box>
              {[...Array(8)].map((_, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ ...skeletonStyle, height: 14, width: '25%' }} />
                  <Box sx={{ ...skeletonStyle, height: 14, width: '20%' }} />
                  <Box sx={{ ...skeletonStyle, height: 14, width: '25%' }} />
                  <Box sx={{ ...skeletonStyle, height: 14, width: '30%' }} />
                </Box>
              ))}
            </Box>
          </Paper>
        );
      
      default:
        return (
          <Paper sx={{ p: 2, height: 200 }}>
            <style>{shimmerKeyframes}</style>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ ...skeletonStyle, height: 20, width: '60%' }} />
              <Box sx={{ ...skeletonStyle, height: 16, width: '80%' }} />
              <Box sx={{ ...skeletonStyle, height: 16, width: '70%' }} />
              <Box sx={{ ...skeletonStyle, height: 40, width: '100%' }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box sx={{ ...skeletonStyle, height: 32, width: '30%' }} />
                <Box sx={{ ...skeletonStyle, height: 32, width: '30%' }} />
              </Box>
            </Box>
          </Paper>
        );
    }
  };

  return (
    <>
      {[...Array(count)].map((_, index) => (
        <Box key={index} sx={{ mb: count > 1 ? 2 : 0 }}>
          {renderCardSkeleton()}
        </Box>
      ))}
    </>
  );
};

export default AnalyticsCardSkeleton;