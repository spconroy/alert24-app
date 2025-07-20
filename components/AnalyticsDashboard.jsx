'use client';

import { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Tabs,
  Tab,
  Paper,
  CircularProgress,
  Button,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  IconButton,
  Menu,
  MenuList,
  ListItemText,
  MenuItem as MenuItemMui,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Timer,
  CheckCircle,
  Error,
  Download,
  Refresh,
  MoreVert,
} from '@mui/icons-material';
import LoadingTransition from './skeletons/LoadingTransition';
import AnalyticsOverviewCards from './AnalyticsOverviewCards';
import AnalyticsUptimeChart from './AnalyticsUptimeChart';
import AnalyticsResponseTimeChart from './AnalyticsResponseTimeChart';
import AnalyticsIncidentMetrics from './AnalyticsIncidentMetrics';
import AnalyticsServiceComparison from './AnalyticsServiceComparison';
import AnalyticsHealthScore from './AnalyticsHealthScore';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} role="tabpanel">
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AnalyticsDashboard({ organizationId }) {
  const [activeTab, setActiveTab] = useState(0);
  const [dateRange, setDateRange] = useState('7d');
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const dateRangeOptions = [
    { value: '1d', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
  ];

  useEffect(() => {
    if (organizationId) {
      loadServices();
    }
  }, [organizationId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/services?organizationId=${organizationId}`
      );
      if (response.ok) {
        const data = await response.json();
        // Handle the API response structure correctly
        const servicesArray = data.services || data || [];
        setServices(servicesArray);
        // If no services, set empty array which will show "All services" analytics
        setSelectedServices(servicesArray.length > 0 ? servicesArray.slice(0, 5).map(s => s.id) : []);
      } else {
        // Handle non-200 responses
        setServices([]);
        setSelectedServices([]);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      // Set empty arrays on error to prevent further exceptions
      setServices([]);
      setSelectedServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLastRefresh(new Date());
    loadServices();
  };

  const handleExportReport = async format => {
    setExportMenuAnchor(null);

    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          dateRange,
          services: selectedServices,
          format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${dateRange}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  const tabs = [
    'Overview',
    'Uptime Analysis',
    'Performance',
    'Incidents',
    'Service Comparison',
    'Health Score',
  ];

  if (loading) {
    return (
      <LoadingTransition
        loading={loading}
        loaderProps={{
          type: 'progressive',
          complexity: 'complex',
          estimatedLoadTime: 5000
        }}
        loadingMessage="Loading analytics dashboard with charts and metrics"
        completedMessage="Analytics dashboard loaded successfully"
      >
        <></>
      </LoadingTransition>
    );
  }

  return (
    <Box>
      {/* Show info message when no services are configured */}
      {!loading && Array.isArray(services) && services.length === 0 && (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
          <Typography variant="body1" gutterBottom>
            <strong>No Services Configured</strong>
          </Typography>
          <Typography variant="body2">
            Analytics data is currently showing default values because no monitoring services have been configured for this organization. 
            Set up your first service to see real monitoring data and trends.
          </Typography>
        </Paper>
      )}

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Date Range</InputLabel>
              <Select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                label="Date Range"
              >
                {dateRangeOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Services</InputLabel>
              <Select
                multiple
                value={selectedServices}
                onChange={e => setSelectedServices(e.target.value)}
                label="Services"
                disabled={!Array.isArray(services) || services.length === 0}
                renderValue={selected => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {!Array.isArray(services) || services.length === 0 ? (
                      <Chip
                        label="No services configured"
                        size="small"
                        variant="outlined"
                        color="default"
                      />
                    ) : Array.isArray(selected) && selected.length === 0 ? (
                      <Chip
                        label="All services"
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    ) : (
                      <>
                        {Array.isArray(selected) &&
                          selected.slice(0, 2).map(value => {
                            const service = Array.isArray(services)
                              ? services.find(s => s?.id === value)
                              : null;
                            return (
                              <Chip
                                key={value || Math.random()}
                                label={service?.name || value || 'Unknown Service'}
                                size="small"
                              />
                            );
                          })}
                        {Array.isArray(selected) && selected.length > 2 && (
                          <Chip
                            label={`+${selected.length - 2} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </>
                    )}
                  </Box>
                )}
              >
                {Array.isArray(services) && services.length > 0 ? (
                  services.map(service => (
                    <MenuItem
                      key={service?.id || Math.random()}
                      value={service?.id}
                    >
                      <ListItemText
                        primary={service?.name || 'Unnamed Service'}
                      />
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    <ListItemText primary="No services available" />
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
                onClick={handleRefresh}
              >
                Refresh
              </Button>

              <IconButton
                size="small"
                onClick={e => setExportMenuAnchor(e.currentTarget)}
              >
                <MoreVert />
              </IconButton>

              <Menu
                anchorEl={exportMenuAnchor}
                open={Boolean(exportMenuAnchor)}
                onClose={() => setExportMenuAnchor(null)}
              >
                <MenuList>
                  <MenuItemMui onClick={() => handleExportReport('csv')}>
                    <Download sx={{ mr: 1 }} />
                    Export CSV
                  </MenuItemMui>
                  <MenuItemMui onClick={() => handleExportReport('pdf')}>
                    <Download sx={{ mr: 1 }} />
                    Export PDF
                  </MenuItemMui>
                </MenuList>
              </Menu>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab key={index} label={tab} />
          ))}
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <AnalyticsOverviewCards
            organizationId={organizationId}
            dateRange={dateRange}
            services={selectedServices}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <AnalyticsUptimeChart
            organizationId={organizationId}
            dateRange={dateRange}
            services={selectedServices}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <AnalyticsResponseTimeChart
            organizationId={organizationId}
            dateRange={dateRange}
            services={selectedServices}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <AnalyticsIncidentMetrics
            organizationId={organizationId}
            dateRange={dateRange}
            services={selectedServices}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <AnalyticsServiceComparison
            organizationId={organizationId}
            dateRange={dateRange}
            services={selectedServices}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={5}>
          <AnalyticsHealthScore
            organizationId={organizationId}
            dateRange={dateRange}
            services={selectedServices}
          />
        </TabPanel>
      </Paper>
    </Box>
  );
}
