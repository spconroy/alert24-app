import React, { useState, useEffect } from 'react';
import { Box, LinearProgress, Typography, Fade } from '@mui/material';

const ProgressiveLoader = ({ 
  stages = ['Loading data...', 'Processing...', 'Rendering...'],
  estimatedTime = 3000,
  onComplete,
  children 
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const stageTime = estimatedTime / stages.length;
    const progressInterval = 50; // Update every 50ms for smooth animation
    const progressStep = 100 / (estimatedTime / progressInterval);

    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = Math.min(prev + progressStep, 100);
        const newStage = Math.min(Math.floor(newProgress / (100 / stages.length)), stages.length - 1);
        
        if (newStage !== currentStage) {
          setCurrentStage(newStage);
        }

        if (newProgress >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setIsComplete(true);
            onComplete?.();
          }, 300);
        }

        return newProgress;
      });
    }, progressInterval);

    return () => clearInterval(timer);
  }, [stages.length, estimatedTime, currentStage, onComplete]);

  if (isComplete) {
    return (
      <Fade in={true} timeout={300}>
        <Box>{children}</Box>
      </Fade>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: 4,
        minHeight: 200
      }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Loading progress: ${stages[currentStage]}`}
    >
      <Box sx={{ width: '100%', maxWidth: 400, mb: 3 }}>
        <LinearProgress 
          variant="determinate" 
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              transition: 'transform 0.1s ease-out'
            }
          }}
        />
      </Box>
      
      <Typography 
        variant="h6" 
        sx={{ 
          mb: 1,
          transition: 'all 0.3s ease-in-out',
          minHeight: 32
        }}
        aria-live="polite"
      >
        {stages[currentStage]}
      </Typography>
      
      <Typography 
        variant="body2" 
        color="text.secondary"
        aria-live="polite"
      >
        {Math.round(progress)}% Complete
      </Typography>

      {estimatedTime > 5000 && (
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ mt: 1 }}
          aria-live="polite"
        >
          Estimated time remaining: {Math.max(0, Math.round((estimatedTime - (progress / 100 * estimatedTime)) / 1000))}s
        </Typography>
      )}
    </Box>
  );
};

export default ProgressiveLoader;