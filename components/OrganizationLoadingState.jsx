'use client';
import React from 'react';
import { Box, CircularProgress, Skeleton, Typography } from '@mui/material';
import { useOrganization } from '@/contexts/OrganizationContext';

const OrganizationLoadingState = ({ 
  children, 
  showSkeleton = false, 
  skeletonHeight = 200,
  loadingMessage = "Loading organization data...",
  fallbackComponent = null 
}) => {
  const { loading, organizationsLoading, isInitialized, selectedOrganization } = useOrganization();

  // Show loading if context is still initializing
  if (loading || !isInitialized) {
    if (showSkeleton) {
      return (
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" width="40%" height={40} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={skeletonHeight} />
        </Box>
      );
    }

    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
        gap={2}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          {loadingMessage}
        </Typography>
      </Box>
    );
  }

  // Show loading if organizations are being fetched
  if (organizationsLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100px"
        gap={1}
      >
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Updating organization data...
        </Typography>
      </Box>
    );
  }

  // Show fallback if no organization is selected
  if (!selectedOrganization && fallbackComponent) {
    return fallbackComponent;
  }

  return children;
};

export default OrganizationLoadingState;