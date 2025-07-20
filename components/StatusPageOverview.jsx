'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  Link as MuiLink,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import Link from 'next/link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useOrganization } from '@/contexts/OrganizationContext';
export default function StatusPageOverview() {
  const [statusPages, setStatusPages] = useState([]);
  const [filteredStatusPages, setFilteredStatusPages] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { session } = useOrganization();

  useEffect(() => {
    if (session) {
      fetchStatusPages();
    }
  }, [session]);

  useEffect(() => {
    if (selectedOrgId === 'all') {
      setFilteredStatusPages(statusPages);
    } else {
      setFilteredStatusPages(
        statusPages.filter(page => page.organization_id === selectedOrgId)
      );
    }
  }, [selectedOrgId, statusPages]);

  const handleOrgFilterChange = event => {
    setSelectedOrgId(event.target.value);
  };

  const fetchStatusPages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/status-pages/all');
      if (!response.ok) {
        throw new Error('Failed to fetch status pages');
      }
      const data = await response.json();
      const pages = data.statusPages || [];
      setStatusPages(pages);
      setFilteredStatusPages(pages);

      // Extract unique organizations
      const uniqueOrgs = pages.reduce((acc, page) => {
        const existing = acc.find(org => org.id === page.organization_id);
        if (!existing) {
          acc.push({
            id: page.organization_id,
            name: page.organization_name,
          });
        }
        return acc;
      }, []);
      setOrganizations(uniqueOrgs);
    } catch (err) {
      console.error('Error fetching status pages:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'operational':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'down':
        return 'error';
      case 'maintenance':
        return 'info';
      default:
        return 'default';
    }
  };

  const getOverallStatus = serviceSummary => {
    if (serviceSummary.total === 0)
      return { status: 'No Services', color: 'default' };
    if (serviceSummary.down > 0) return { status: 'Outage', color: 'error' };
    if (serviceSummary.degraded > 0)
      return { status: 'Partial Outage', color: 'warning' };
    if (serviceSummary.maintenance > 0)
      return { status: 'Under Maintenance', color: 'info' };
    return { status: 'All Systems Operational', color: 'success' };
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading status pages: {error}
      </Alert>
    );
  }

  if (statusPages.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Status Pages Found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You don't have access to any status pages yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h2" gutterBottom>
        Your Status Pages
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Monitor the health of all your services across organizations
      </Typography>

      {/* Organization Filter */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-start' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="org-filter-label">Filter by Organization</InputLabel>
          <Select
            labelId="org-filter-label"
            id="org-filter"
            value={selectedOrgId}
            label="Filter by Organization"
            onChange={handleOrgFilterChange}
          >
            <MenuItem value="all">All Organizations</MenuItem>
            {organizations.map(org => (
              <MenuItem key={org.id} value={org.id}>
                {org.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {filteredStatusPages.length === 0 && selectedOrgId !== 'all' ? (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Status Pages Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No status pages found for the selected organization.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredStatusPages.map(statusPage => {
            const overallStatus = getOverallStatus(statusPage.service_summary);

            return (
              <Grid size={{ xs: 12, md: 6 }} lg={4} key={statusPage.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      mb={2}
                    >
                      <Typography variant="h6" component="h3" gutterBottom>
                        {statusPage.name}
                      </Typography>
                      <Chip
                        label={overallStatus.status}
                        color={overallStatus.color}
                        size="small"
                      />
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Organization: {statusPage.organization_name}
                    </Typography>

                    {statusPage.description && (
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {statusPage.description}
                      </Typography>
                    )}

                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Services ({statusPage.service_summary.total})
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {statusPage.service_summary.operational > 0 && (
                          <Chip
                            label={`${statusPage.service_summary.operational} Operational`}
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {statusPage.service_summary.degraded > 0 && (
                          <Chip
                            label={`${statusPage.service_summary.degraded} Degraded`}
                            color="warning"
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {statusPage.service_summary.down > 0 && (
                          <Chip
                            label={`${statusPage.service_summary.down} Down`}
                            color="error"
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {statusPage.service_summary.maintenance > 0 && (
                          <Chip
                            label={`${statusPage.service_summary.maintenance} Maintenance`}
                            color="info"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </CardContent>

                  <CardActions
                    sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}
                  >
                    <Button
                      component={Link}
                      href={`/settings?org=${statusPage.organization_id}&statusPage=${statusPage.id}`}
                      variant="outlined"
                      size="small"
                    >
                      Manage
                    </Button>
                    <Button
                      component={MuiLink}
                      href={`/status/${statusPage.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="contained"
                      size="small"
                      endIcon={<OpenInNewIcon />}
                    >
                      View Public Page
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
