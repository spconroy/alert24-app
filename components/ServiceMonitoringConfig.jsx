import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close,
  MonitorHeart,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Pause,
} from '@mui/icons-material';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function ServiceMonitoringConfig({
  open,
  onClose,
  service,
  onConfigUpdated,
}) {
  const [availableChecks, setAvailableChecks] = useState([]);
  const [associatedChecks, setAssociatedChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { selectedOrganization } = useOrganization();

  // Form state for each check association
  const [checkConfigs, setCheckConfigs] = useState({});

  useEffect(() => {
    if (open && service && selectedOrganization) {
      fetchAvailableChecks();
      loadCurrentAssociations();
    } else if (!open) {
      // Reset state when modal closes
      resetState();
    }
  }, [open, service, selectedOrganization]);

  const fetchAvailableChecks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/monitoring?organization_id=${selectedOrganization.id}&limit=100`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch monitoring checks');
      }

      const data = await response.json();
      setAvailableChecks(data.monitoring_checks || []);
    } catch (err) {
      console.error('Error fetching monitoring checks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentAssociations = () => {
    try {
      // Use existing service.monitoring_checks data instead of making API call
      const existingChecks = service.monitoring_checks || [];

      // Set associated check IDs
      const associatedIds = existingChecks.map(check => check.id);
      setAssociatedChecks(associatedIds);

      // Initialize check configs from existing data
      const configs = {};
      existingChecks.forEach(check => {
        configs[check.id] = {
          failure_threshold_minutes: check.failure_threshold || 5,
          failure_message: check.failure_message || '',
        };
      });
      setCheckConfigs(configs);

      console.log('Loaded existing associations:', {
        associatedIds,
        configs,
        existingChecks,
      });
    } catch (err) {
      console.error('Error loading current associations:', err);
    }
  };

  const handleCheckToggle = checkId => {
    const newAssociated = new Set(associatedChecks);

    if (newAssociated.has(checkId)) {
      newAssociated.delete(checkId);
      // Remove config for this check
      const newConfigs = { ...checkConfigs };
      delete newConfigs[checkId];
      setCheckConfigs(newConfigs);
    } else {
      newAssociated.add(checkId);
      // Initialize default config for this check
      setCheckConfigs(prev => ({
        ...prev,
        [checkId]: {
          failure_threshold_minutes: 5,
          failure_message: '',
        },
      }));
    }

    setAssociatedChecks(Array.from(newAssociated));
  };

  const handleConfigChange = (checkId, field, value) => {
    setCheckConfigs(prev => ({
      ...prev,
      [checkId]: {
        ...prev[checkId],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Prepare associations data
      const associations = associatedChecks.map(checkId => ({
        monitoring_check_id: checkId,
        failure_threshold_minutes:
          checkConfigs[checkId]?.failure_threshold_minutes || 5,
        failure_message: checkConfigs[checkId]?.failure_message || '',
      }));

      const response = await fetch(`/api/services/${service.id}/monitoring`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ associations }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 'Failed to save monitoring configuration'
        );
      }

      // Notify parent component to refresh
      onConfigUpdated?.();
      onClose();
    } catch (err) {
      console.error('Error saving monitoring configuration:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getCheckStatus = check => {
    if (check.current_status === 'up')
      return { icon: <CheckCircle />, color: 'success' };
    if (check.current_status === 'down')
      return { icon: <ErrorIcon />, color: 'error' };
    if (check.current_status === 'warning')
      return { icon: <Warning />, color: 'warning' };
    if (check.current_status === 'inactive')
      return { icon: <Pause />, color: 'default' };
    return { icon: <MonitorHeart />, color: 'default' };
  };

  const resetState = () => {
    setAssociatedChecks([]);
    setCheckConfigs({});
    setError(null);
    setAvailableChecks([]);
  };

  if (!service) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6">
              Configure Monitoring for &quot;{service.name}&quot;
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Associate monitoring checks to automatically update service status
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Summary */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Select monitoring checks to associate with this service. When a
                check fails for the specified duration, the service status will
                be updated automatically.
              </Typography>
            </Alert>

            {/* Available Checks */}
            <Typography variant="h6" gutterBottom>
              Available Monitoring Checks ({availableChecks.length})
            </Typography>

            {availableChecks.length === 0 ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No monitoring checks found for this organization. Create
                monitoring checks first before associating them with services.
              </Alert>
            ) : (
              <List>
                {availableChecks.map(check => {
                  const isAssociated = associatedChecks.includes(check.id);
                  const status = getCheckStatus(check);
                  const config = checkConfigs[check.id] || {};

                  return (
                    <Box key={check.id}>
                      <ListItem
                        dense
                        sx={{
                          border: '1px solid',
                          borderColor: isAssociated
                            ? 'primary.main'
                            : 'divider',
                          borderRadius: 1,
                          mb: 1,
                          backgroundColor: isAssociated
                            ? 'primary.50'
                            : 'transparent',
                        }}
                      >
                        <Checkbox
                          checked={isAssociated}
                          onChange={() => handleCheckToggle(check.id)}
                          color="primary"
                        />
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" fontWeight="medium">
                                {check.name}
                              </Typography>
                              <Chip
                                icon={status.icon}
                                label={check.current_status || 'unknown'}
                                size="small"
                                color={status.color}
                                variant="outlined"
                              />
                              <Chip
                                label={check.check_type}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                Target: {check.target_url}
                              </Typography>
                              <Typography
                                variant="caption"
                                display="block"
                                color="text.secondary"
                              >
                                Interval: {check.check_interval || 300}s
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>

                      {/* Configuration for associated checks */}
                      {isAssociated && (
                        <Box
                          sx={{
                            ml: 4,
                            mb: 2,
                            p: 2,
                            backgroundColor: 'grey.50',
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="subtitle2" gutterBottom>
                            Failure Configuration
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Failure Threshold (minutes)"
                                type="number"
                                size="small"
                                value={config.failure_threshold_minutes || 5}
                                onChange={e =>
                                  handleConfigChange(
                                    check.id,
                                    'failure_threshold_minutes',
                                    parseInt(e.target.value) || 5
                                  )
                                }
                                helperText="How long the check must be failing before updating service status"
                                inputProps={{ min: 1, max: 1440 }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                label="Custom Failure Message"
                                size="small"
                                multiline
                                rows={2}
                                value={config.failure_message || ''}
                                onChange={e =>
                                  handleConfigChange(
                                    check.id,
                                    'failure_message',
                                    e.target.value
                                  )
                                }
                                helperText="Optional custom message to display when this check fails (leave empty for default)"
                                placeholder={`${service.name} is experiencing issues`}
                              />
                            </Grid>
                          </Grid>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </List>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || availableChecks.length === 0}
        >
          {saving ? <CircularProgress size={20} /> : 'Save Configuration'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
