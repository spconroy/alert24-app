import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';

export default function EditServiceForm({
  open,
  onClose,
  service,
  onServiceUpdated,
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'operational',
    sort_order: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize form data when service changes
  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        status: service.status || 'operational',
        sort_order: service.sort_order || 0,
      });
    }
  }, [service]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update service');
      }

      const data = await response.json();
      console.log('Service updated successfully:', data);

      // Notify parent component
      onServiceUpdated?.(data.service);

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error updating service:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!service) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Edit Service</Typography>
          <IconButton onClick={handleClose} size="small">
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

        <Box sx={{ pt: 1 }}>
          <TextField
            fullWidth
            label="Service Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            margin="normal"
            disabled={loading}
            helperText="The display name for this service"
          />

          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            multiline
            rows={3}
            margin="normal"
            disabled={loading}
            helperText="Optional description of what this service provides"
          />

          <FormControl fullWidth margin="normal" disabled={loading}>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              label="Status"
            >
              <MenuItem value="operational">
                <Box display="flex" alignItems="center" gap={1}>
                  <Box
                    width={8}
                    height={8}
                    borderRadius="50%"
                    bgcolor="success.main"
                  />
                  Operational
                </Box>
              </MenuItem>
              <MenuItem value="degraded">
                <Box display="flex" alignItems="center" gap={1}>
                  <Box
                    width={8}
                    height={8}
                    borderRadius="50%"
                    bgcolor="warning.main"
                  />
                  Degraded
                </Box>
              </MenuItem>
              <MenuItem value="down">
                <Box display="flex" alignItems="center" gap={1}>
                  <Box
                    width={8}
                    height={8}
                    borderRadius="50%"
                    bgcolor="error.main"
                  />
                  Down
                </Box>
              </MenuItem>
              <MenuItem value="maintenance">
                <Box display="flex" alignItems="center" gap={1}>
                  <Box
                    width={8}
                    height={8}
                    borderRadius="50%"
                    bgcolor="info.main"
                  />
                  Maintenance
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Sort Order"
            name="sort_order"
            type="number"
            value={formData.sort_order}
            onChange={handleInputChange}
            margin="normal"
            disabled={loading}
            helperText="Lower numbers appear first in the list"
            inputProps={{ min: 0 }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading || !formData.name.trim()}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Updating...
            </>
          ) : (
            'Update Service'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
