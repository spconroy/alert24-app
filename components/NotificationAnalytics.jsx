import { useState, useEffect, useContext } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { OrganizationContext } from '@/contexts/OrganizationContext';

export default function NotificationAnalytics() {
  const { currentOrganization } = useContext(OrganizationContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchStats();
    }
  }, [currentOrganization, timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/notifications/stats?organizationId=${currentOrganization.id}&timeRange=${timeRange}`
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        throw new Error('Failed to fetch stats');
      }
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
  };

  const formatPercentage = (value) => {
    return `${Math.round(value * 100) / 100}%`;
  };

  const formatNumber = (value) => {
    return value.toLocaleString();
  };

  if (!currentOrganization) {
    return (
      <Card>
        <CardContent>
          <Typography>Please select an organization to view notification analytics.</Typography>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AnalyticsIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Notification Analytics</Typography>
          </Box>
          <LinearProgress />
          <Typography sx={{ mt: 2 }}>Loading analytics...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent>
          <Typography>Failed to load notification analytics.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AnalyticsIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Notification Analytics</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                label="Time Range"
                onChange={handleTimeRangeChange}
              >
                <MenuItem value="1h">Last Hour</MenuItem>
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <EmailIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">{formatNumber(stats.total)}</Typography>
                  </Box>
                  <Typography variant="body2">Total Notifications</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CheckCircleIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">{formatNumber(stats.sent)}</Typography>
                  </Box>
                  <Typography variant="body2">Successfully Sent</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'error.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ErrorIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">{formatNumber(stats.failed)}</Typography>
                  </Box>
                  <Typography variant="body2">Failed to Send</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ScheduleIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">{formatNumber(stats.pending)}</Typography>
                  </Box>
                  <Typography variant="body2">Pending</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3 }}>
            <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TrendingUpIcon sx={{ mr: 1, color: 'success.main' }} />
              Delivery Rate: {formatPercentage(stats.deliveryRate)}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={stats.deliveryRate} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Notifications by Type</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Sent</TableCell>
                      <TableCell align="right">Failed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.byType).map(([type, data]) => (
                      <TableRow key={type}>
                        <TableCell>
                          <Chip 
                            label={type} 
                            size="small" 
                            color={type === 'incident' ? 'error' : type === 'monitoring' ? 'warning' : 'primary'}
                          />
                        </TableCell>
                        <TableCell align="right">{formatNumber(data.total)}</TableCell>
                        <TableCell align="right">{formatNumber(data.sent)}</TableCell>
                        <TableCell align="right">{formatNumber(data.failed)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Notifications by Priority</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Priority</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Sent</TableCell>
                      <TableCell align="right">Failed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.byPriority).map(([priority, data]) => (
                      <TableRow key={priority}>
                        <TableCell>
                          <Chip 
                            label={priority} 
                            size="small" 
                            color={priority === 'critical' ? 'error' : priority === 'high' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">{formatNumber(data.total)}</TableCell>
                        <TableCell align="right">{formatNumber(data.sent)}</TableCell>
                        <TableCell align="right">{formatNumber(data.failed)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Retry Statistics</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {formatNumber(stats.retryStats.singleAttempt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Single Attempt
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {formatNumber(stats.retryStats.multipleAttempts)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Multiple Attempts
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="secondary">
                      {stats.retryStats.maxAttempts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Max Attempts
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {stats.retryStats.avgAttempts.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Attempts
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Data generated at: {new Date(stats.generatedAt).toLocaleString()}
      </Typography>
    </Box>
  );
}