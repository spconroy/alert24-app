'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Paper,
  LinearProgress,
  Chip,
} from '@mui/material';
import { Assessment, CheckCircle, Warning, Error } from '@mui/icons-material';

function HealthScoreGauge({ score, title }) {
  const getColor = score => {
    if (score >= 95) return '#4caf50';
    if (score >= 90) return '#8bc34a';
    if (score >= 80) return '#ff9800';
    if (score >= 70) return '#ff5722';
    return '#f44336';
  };

  const getLabel = score => {
    if (score >= 95) return 'Excellent';
    if (score >= 90) return 'Good';
    if (score >= 80) return 'Fair';
    if (score >= 70) return 'Poor';
    return 'Critical';
  };

  return (
    <Card>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
          <CircularProgress
            variant="determinate"
            value={100}
            size={120}
            thickness={4}
            sx={{ color: 'grey.300' }}
          />
          <CircularProgress
            variant="determinate"
            value={score}
            size={120}
            thickness={4}
            sx={{
              color: getColor(score),
              position: 'absolute',
              left: 0,
              transform: 'rotate(-90deg)',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            <Typography variant="h4" component="div" fontWeight="bold">
              {score}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              / 100
            </Typography>
          </Box>
        </Box>
        <Chip
          label={getLabel(score)}
          color={score >= 90 ? 'success' : score >= 70 ? 'warning' : 'error'}
          variant="outlined"
        />
      </CardContent>
    </Card>
  );
}

function HealthFactors({ factors }) {
  const getIcon = type => {
    switch (type) {
      case 'uptime':
        return <CheckCircle />;
      case 'performance':
        return <Assessment />;
      case 'incidents':
        return <Warning />;
      case 'alerts':
        return <Error />;
      default:
        return <Assessment />;
    }
  };

  const getColor = score => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Health Factors
        </Typography>
        <Box sx={{ mt: 2 }}>
          {factors.map((factor, index) => (
            <Box key={index} sx={{ mb: 2 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                {getIcon(factor.type)}
                <Typography variant="body2" fontWeight="medium">
                  {factor.name}
                </Typography>
                <Box sx={{ ml: 'auto' }}>
                  <Typography variant="body2" fontWeight="bold">
                    {factor.score}/100
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={factor.score}
                color={getColor(factor.score)}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
              >
                {factor.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsHealthScore({
  organizationId,
  dateRange,
  services,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    overallScore: 0,
    factors: [],
    recommendations: [],
  });

  useEffect(() => {
    if (organizationId) {
      loadHealthScoreData();
    }
  }, [organizationId, dateRange, services]);

  const loadHealthScoreData = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/analytics/health-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          dateRange,
          services,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error loading health score data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading health score data...
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <HealthScoreGauge
            score={data.overallScore}
            title="Overall Health Score"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <HealthFactors factors={data.factors} />
        </Grid>

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recommendations for Improvement
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {data.recommendations.map((rec, index) => (
                    <Paper
                      key={index}
                      sx={{
                        p: 2,
                        mb: 2,
                        backgroundColor: 'info.light',
                        color: 'info.contrastText',
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        gutterBottom
                      >
                        {rec.title}
                      </Typography>
                      <Typography variant="body2">{rec.description}</Typography>
                      {rec.impact && (
                        <Chip
                          label={`Potential impact: +${rec.impact} points`}
                          size="small"
                          color="info"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
