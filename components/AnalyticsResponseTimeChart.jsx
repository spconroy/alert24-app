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
  Chip
} from '@mui/material';
import { Speed, TrendingUp, TrendingDown } from '@mui/icons-material';

function ResponseTimeChart({ data, title }) {
  const maxValue = Math.max(...data.map(d => d.value), 1000);
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box sx={{ height: 200, position: 'relative', mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'end', height: '100%', gap: 1 }}>
            {data.map((point, index) => {
              const height = (point.value / maxValue) * 100;
              const color = point.value <= 500 ? '#4caf50' : point.value <= 1000 ? '#ff9800' : '#f44336';
              
              return (
                <Box
                  key={index}
                  sx={{
                    height: `${Math.max(height, 2)}%`,
                    backgroundColor: color,
                    flex: 1,
                    borderRadius: '2px 2px 0 0',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    '&:hover': {
                      opacity: 0.8,
                      '&::after': {
                        content: `"${point.label}: ${point.value}ms"`,
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        zIndex: 1000
                      }
                    }
                  }}
                />
              );
            })}
          </Box>
          
          <Box sx={{ position: 'absolute', left: -50, top: 0, height: '100%', display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">0ms</Typography>
            <Typography variant="caption" color="text.secondary">{Math.round(maxValue/2)}ms</Typography>
            <Typography variant="caption" color="text.secondary">{maxValue}ms</Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, backgroundColor: '#4caf50', borderRadius: 1 }} />
            <Typography variant="caption">Fast (≤500ms)</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, backgroundColor: '#ff9800', borderRadius: 1 }} />
            <Typography variant="caption">Moderate (500-1000ms)</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, backgroundColor: '#f44336', borderRadius: 1 }} />
            <Typography variant="caption">Slow (&gt;1000ms)</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsResponseTimeChart({ organizationId, dateRange, services }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    timeline: [],
    summary: {
      avgResponseTime: 0,
      trend: 0,
      fastestResponse: 0,
      slowestResponse: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0
    }
  });

  useEffect(() => {
    if (organizationId && services.length > 0) {
      loadResponseTimeData();
    }
  }, [organizationId, dateRange, services]);

  const loadResponseTimeData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          dateRange,
          services
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error loading response time data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading performance data...
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Speed color="primary" />
                <Typography variant="h6" fontSize="0.875rem" color="text.secondary">
                  Avg Response
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {data.summary.avgResponseTime}ms
              </Typography>
              {data.summary.trend !== 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  {data.summary.trend < 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
                  <Typography variant="caption" color={data.summary.trend < 0 ? 'success.main' : 'error.main'}>
                    {Math.abs(data.summary.trend)}ms vs previous
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontSize="0.875rem" color="text.secondary">
                Fastest
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {data.summary.fastestResponse}ms
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontSize="0.875rem" color="text.secondary">
                Slowest
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="error.main">
                {data.summary.slowestResponse}ms
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontSize="0.875rem" color="text.secondary">
                95th Percentile
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {data.summary.p95ResponseTime}ms
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontSize="0.875rem" color="text.secondary">
                99th Percentile
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {data.summary.p99ResponseTime}ms
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontSize="0.875rem" color="text.secondary">
                Performance
              </Typography>
              <Chip 
                label={data.summary.avgResponseTime <= 500 ? 'Excellent' : data.summary.avgResponseTime <= 1000 ? 'Good' : 'Needs Improvement'}
                color={data.summary.avgResponseTime <= 500 ? 'success' : data.summary.avgResponseTime <= 1000 ? 'warning' : 'error'}
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Response Time Chart */}
      <ResponseTimeChart data={data.timeline} title="Response Time Trend" />

      {/* Performance Guidelines */}
      <Paper sx={{ p: 2, mt: 3, backgroundColor: 'info.light', color: 'info.contrastText' }}>
        <Typography variant="body2">
          <strong>Performance Guidelines:</strong> ≤200ms (Excellent) | 200-500ms (Good) | 500-1000ms (Acceptable) | &gt;1000ms (Poor)
        </Typography>
      </Paper>
    </Box>
  );
}