'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  FormHelperText,
  Typography,
  Card,
  CardContent,
  Grid,
  Tooltip,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Language as GlobalIcon,
  LocationOn as LocationIcon,
  Speed as PerformanceIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

export default function MonitoringLocationSelector({
  selectedLocations = [],
  onLocationChange,
  multiple = true,
  label = 'Monitoring Locations',
  helperText = 'Choose geographic locations for monitoring checks',
}) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMonitoringLocations();
  }, []);

  const fetchMonitoringLocations = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        '/api/monitoring-locations?active_only=true'
      );

      if (response.ok) {
        const data = await response.json();
        setLocations(data.monitoring_locations || []);
      } else {
        throw new Error('Failed to fetch monitoring locations');
      }
    } catch (err) {
      console.error('Error fetching monitoring locations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationChange = event => {
    const value = event.target.value;
    if (multiple) {
      // For multiple selection, value is an array
      const newSelectedLocations =
        typeof value === 'string' ? value.split(',') : value;
      onLocationChange(newSelectedLocations);
    } else {
      // For single selection
      onLocationChange(value);
    }
  };

  const getLocationName = locationId => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? `${location.name} (${location.code})` : locationId;
  };

  const getRegionColor = region => {
    switch (region) {
      case 'North America':
        return 'primary';
      case 'Europe':
        return 'secondary';
      case 'Asia Pacific':
        return 'success';
      case 'South America':
        return 'warning';
      case 'Africa':
        return 'info';
      default:
        return 'default';
    }
  };

  const getLocationStats = location => {
    return {
      responseTime: location.avg_response_time || 0,
      reliability: location.reliability_score || 100,
    };
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading monitoring locations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading monitoring locations: {error}
      </Alert>
    );
  }

  return (
    <Box>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>{label}</InputLabel>
        <Select
          multiple={multiple}
          value={multiple ? selectedLocations : selectedLocations[0] || ''}
          label={label}
          onChange={handleLocationChange}
          renderValue={selected => {
            if (multiple) {
              return (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map(locationId => {
                    const location = locations.find(
                      loc => loc.id === locationId
                    );
                    return (
                      <Chip
                        key={locationId}
                        label={location ? location.name : locationId}
                        size="small"
                        color={
                          location ? getRegionColor(location.region) : 'default'
                        }
                        icon={<LocationIcon />}
                      />
                    );
                  })}
                </Box>
              );
            } else {
              return getLocationName(selected);
            }
          }}
        >
          {locations.map(location => {
            const stats = getLocationStats(location);
            return (
              <MenuItem key={location.id} value={location.id}>
                <Box display="flex" alignItems="center" gap={1} width="100%">
                  <LocationIcon
                    color={getRegionColor(location.region)}
                    fontSize="small"
                  />
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight="medium">
                      {location.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {location.city}, {location.country} • {location.code}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    {location.is_default && (
                      <Tooltip title="Default location">
                        <CheckCircleIcon color="primary" fontSize="small" />
                      </Tooltip>
                    )}
                    <Tooltip title={`${stats.reliability}% reliability`}>
                      <Chip
                        label={`${stats.reliability}%`}
                        size="small"
                        color={
                          stats.reliability >= 99
                            ? 'success'
                            : stats.reliability >= 95
                              ? 'warning'
                              : 'error'
                        }
                        variant="outlined"
                      />
                    </Tooltip>
                  </Box>
                </Box>
              </MenuItem>
            );
          })}
        </Select>
        <FormHelperText>{helperText}</FormHelperText>
      </FormControl>

      {/* Location Overview Cards */}
      {selectedLocations.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Locations ({selectedLocations.length})
          </Typography>
          <Grid container spacing={2}>
            {selectedLocations.map(locationId => {
              const location = locations.find(loc => loc.id === locationId);
              if (!location) return null;

              const stats = getLocationStats(location);

              return (
                <Grid item xs={12} sm={6} md={4} key={location.id}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <LocationIcon
                          color={getRegionColor(location.region)}
                          fontSize="small"
                        />
                        <Typography variant="subtitle2" fontWeight="medium">
                          {location.name}
                        </Typography>
                        {location.is_default && (
                          <Chip label="Default" size="small" color="primary" />
                        )}
                      </Box>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        mb={1}
                      >
                        {location.description}
                      </Typography>

                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Chip
                            label={location.region}
                            size="small"
                            color={getRegionColor(location.region)}
                            variant="outlined"
                          />
                        </Box>

                        <Box display="flex" alignItems="center" gap={1}>
                          <Tooltip title="Average response time">
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <PerformanceIcon
                                fontSize="small"
                                color="action"
                              />
                              <Typography variant="caption">
                                {stats.responseTime}ms
                              </Typography>
                            </Box>
                          </Tooltip>

                          <Tooltip title="Reliability score">
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <CheckCircleIcon
                                fontSize="small"
                                color={
                                  stats.reliability >= 99 ? 'success' : 'action'
                                }
                              />
                              <Typography variant="caption">
                                {stats.reliability}%
                              </Typography>
                            </Box>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {/* Global Coverage Tip */}
      {multiple && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <GlobalIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" color="primary">
              Global Monitoring Coverage
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Select multiple locations to monitor your services from different
            geographic regions. This helps detect regional outages and provides
            more comprehensive monitoring coverage.
          </Typography>

          {selectedLocations.length === 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedLocations.includes(
                    '00000000-0000-0000-0000-000000000001'
                  )}
                  onChange={e => {
                    if (e.target.checked) {
                      onLocationChange([
                        '00000000-0000-0000-0000-000000000001',
                      ]);
                    } else {
                      onLocationChange([]);
                    }
                  }}
                />
              }
              label="Use default location (US East)"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
