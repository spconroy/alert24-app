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

const ChartSkeleton = ({ type = 'bar', height = 300, showTitle = true }) => {
  const skeletonStyle = {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200px 100%',
    animation: 'shimmer 1.5s infinite linear',
    borderRadius: 1,
  };

  const renderBarChart = () => (
    <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', height: '100%', gap: 1 }}>
      {[...Array(12)].map((_, i) => (
        <Box 
          key={i} 
          sx={{ 
            ...skeletonStyle, 
            width: '100%',
            height: `${Math.random() * 60 + 20}%`,
            maxWidth: 40
          }} 
        />
      ))}
    </Box>
  );

  const renderLineChart = () => (
    <Box sx={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f0f0f0" />
            <stop offset="50%" stopColor="#e0e0e0" />
            <stop offset="100%" stopColor="#f0f0f0" />
          </linearGradient>
        </defs>
        <path
          d="M 0 80 Q 50 60 100 70 T 200 65 T 300 75 T 400 60"
          stroke="url(#shimmerGradient)"
          strokeWidth="3"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M 0 90 Q 50 85 100 88 T 200 82 T 300 85 T 400 80"
          stroke="url(#shimmerGradient)"
          strokeWidth="3"
          fill="none"
          opacity="0.5"
        />
      </svg>
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between' }}>
        {[...Array(7)].map((_, i) => (
          <Box key={i} sx={{ ...skeletonStyle, height: 2, width: 2, borderRadius: '50%' }} />
        ))}
      </Box>
    </Box>
  );

  const renderPieChart = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <Box sx={{ position: 'relative', width: 150, height: 150 }}>
        <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="75" cy="75" r="60" fill="none" stroke="#f0f0f0" strokeWidth="20" />
          <circle 
            cx="75" 
            cy="75" 
            r="60" 
            fill="none" 
            stroke="#e0e0e0" 
            strokeWidth="20"
            strokeDasharray="120 377"
            style={{ animation: 'shimmer 1.5s infinite linear' }}
          />
          <circle 
            cx="75" 
            cy="75" 
            r="60" 
            fill="none" 
            stroke="#d0d0d0" 
            strokeWidth="20"
            strokeDasharray="90 377"
            strokeDashoffset="120"
            style={{ animation: 'shimmer 1.5s infinite linear', animationDelay: '0.5s' }}
          />
        </svg>
      </Box>
    </Box>
  );

  const renderHeatmap = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, height: '100%' }}>
      {[...Array(35)].map((_, i) => (
        <Box 
          key={i} 
          sx={{ 
            ...skeletonStyle, 
            aspectRatio: '1',
            opacity: Math.random() * 0.8 + 0.2,
            animationDelay: `${Math.random() * 2}s`
          }} 
        />
      ))}
    </Box>
  );

  const renderChart = () => {
    switch (type) {
      case 'line': return renderLineChart();
      case 'pie': return renderPieChart();
      case 'heatmap': return renderHeatmap();
      case 'bar':
      default: return renderBarChart();
    }
  };

  return (
    <Paper sx={{ p: 2, height }}>
      <style>{shimmerKeyframes}</style>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
        {showTitle && (
          <Box sx={{ ...skeletonStyle, height: 20, width: '60%' }} />
        )}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {renderChart()}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ ...skeletonStyle, height: 12, width: '30%' }} />
          <Box sx={{ ...skeletonStyle, height: 12, width: '30%' }} />
        </Box>
      </Box>
    </Paper>
  );
};

export default ChartSkeleton;