'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

export default function AnalyticsServiceComparison({ organizationId, dateRange, services }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  useEffect(() => {
    if (organizationId && services.length > 0) {
      loadComparisonData();
    }
  }, [organizationId, dateRange, services]);

  const loadComparisonData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/analytics/comparison', {
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
      console.error('Error loading comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUptimeColor = (uptime) => {
    if (uptime >= 99.5) return 'success';
    if (uptime >= 95) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading service comparison...
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Service Performance Comparison
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell>Uptime</TableCell>
                  <TableCell>Avg Response Time</TableCell>
                  <TableCell>Incidents</TableCell>
                  <TableCell>Health Score</TableCell>
                  <TableCell>Trend</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">
                        No service data available for comparison
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((service, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography fontWeight="medium">{service.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ minWidth: 120 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {service.uptime.toFixed(2)}%
                            </Typography>
                            <Chip
                              size="small"
                              label={service.uptime >= 99.5 ? 'Excellent' : service.uptime >= 95 ? 'Good' : 'Poor'}
                              color={getUptimeColor(service.uptime)}
                            />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={service.uptime}
                            color={getUptimeColor(service.uptime)}
                            sx={{ mt: 0.5, height: 4 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography>{service.avgResponseTime}ms</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography>{service.incidents}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ minWidth: 100 }}>
                          <Typography variant="body2" fontWeight="medium">
                            {service.healthScore}/100
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={service.healthScore}
                            color={service.healthScore >= 90 ? 'success' : service.healthScore >= 70 ? 'warning' : 'error'}
                            sx={{ mt: 0.5, height: 4 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {service.trend > 0 ? (
                            <TrendingUp color="success" />
                          ) : service.trend < 0 ? (
                            <TrendingDown color="error" />
                          ) : null}
                          <Typography
                            variant="caption"
                            color={service.trend > 0 ? 'success.main' : service.trend < 0 ? 'error.main' : 'text.secondary'}
                          >
                            {service.trend === 0 ? 'Stable' : `${Math.abs(service.trend).toFixed(1)}%`}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}