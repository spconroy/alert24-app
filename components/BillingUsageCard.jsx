'use client';

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Chip,
  Grid,
  Alert,
  Button,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Link from 'next/link';

const BillingUsageCard = ({ organization, usage, subscription, onUpgrade }) => {
  const planLimits = {
    free: {
      max_team_members: 3,
      max_monitoring_checks: 5,
      max_status_pages: 1,
      max_api_calls_per_month: 1000,
    },
    pro: {
      max_team_members: 15,
      max_monitoring_checks: 50,
      max_status_pages: 5,
      max_api_calls_per_month: 10000,
    },
    enterprise: {
      max_team_members: 999,
      max_monitoring_checks: 999,
      max_status_pages: 999,
      max_api_calls_per_month: 100000,
    },
  };

  const currentPlan = subscription?.plan || 'free';
  const limits = planLimits[currentPlan];

  const calculateUsagePercentage = (current, max) => {
    if (max === 999) return 0; // Unlimited plans
    return Math.min((current / max) * 100, 100);
  };

  const getUsageColor = percentage => {
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'success';
  };

  const getUsageIcon = percentage => {
    if (percentage >= 90) return <WarningIcon color="error" />;
    return <CheckCircleIcon color="success" />;
  };

  const isOverLimit = (current, max) => {
    return max !== 999 && current > max;
  };

  const usageItems = [
    {
      label: 'Team Members',
      current: usage?.team_members || 0,
      max: limits.max_team_members,
      key: 'team_members',
    },
    {
      label: 'Monitoring Checks',
      current: usage?.monitoring_checks || 0,
      max: limits.max_monitoring_checks,
      key: 'monitoring_checks',
    },
    {
      label: 'Status Pages',
      current: usage?.status_pages || 0,
      max: limits.max_status_pages,
      key: 'status_pages',
    },
    {
      label: 'API Calls (Monthly)',
      current: usage?.api_calls_monthly || 0,
      max: limits.max_api_calls_per_month,
      key: 'api_calls',
    },
  ];

  const overLimitItems = usageItems.filter(item =>
    isOverLimit(item.current, item.max)
  );
  const nearLimitItems = usageItems.filter(item => {
    const percentage = calculateUsagePercentage(item.current, item.max);
    return percentage >= 75 && !isOverLimit(item.current, item.max);
  });

  return (
    <Card>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">Usage & Limits</Typography>
          <Chip
            label={`${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan`}
            color={currentPlan === 'free' ? 'default' : 'primary'}
            size="small"
          />
        </Box>

        {/* Alerts for over-limit usage */}
        {overLimitItems.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              You have exceeded limits for:{' '}
              {overLimitItems.map(item => item.label).join(', ')}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="error"
              component={Link}
              href="/billing"
              sx={{ mt: 1 }}
            >
              Upgrade Plan
            </Button>
          </Alert>
        )}

        {/* Alerts for near-limit usage */}
        {nearLimitItems.length > 0 && overLimitItems.length === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              You are approaching limits for:{' '}
              {nearLimitItems.map(item => item.label).join(', ')}
            </Typography>
          </Alert>
        )}

        {/* Usage breakdown */}
        <Grid container spacing={2}>
          {usageItems.map(item => {
            const percentage = calculateUsagePercentage(item.current, item.max);
            const isUnlimited = item.max === 999;
            const isOver = isOverLimit(item.current, item.max);

            return (
              <Grid size={{ xs: 12, sm: 6 }} key={item.key}>
                <Box>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {item.label}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {!isUnlimited && getUsageIcon(percentage)}
                      <Typography variant="body2" fontWeight="bold">
                        {item.current} / {isUnlimited ? '∞' : item.max}
                      </Typography>
                    </Box>
                  </Box>
                  {!isUnlimited && (
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(percentage, 100)}
                      color={isOver ? 'error' : getUsageColor(percentage)}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  )}
                  {isUnlimited && (
                    <Box
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'success.light',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="success.contrastText"
                      >
                        Unlimited
                      </Typography>
                    </Box>
                  )}
                  {!isUnlimited && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      {percentage.toFixed(1)}% used
                    </Typography>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>

        {/* Upgrade suggestion */}
        {(overLimitItems.length > 0 || nearLimitItems.length > 0) &&
          currentPlan !== 'enterprise' && (
            <Box mt={3} textAlign="center">
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Need more capacity?
              </Typography>
              <Button
                variant="contained"
                color="primary"
                component={Link}
                href="/billing"
                onClick={onUpgrade}
              >
                Upgrade Plan
              </Button>
            </Box>
          )}
      </CardContent>
    </Card>
  );
};

export default BillingUsageCard;
