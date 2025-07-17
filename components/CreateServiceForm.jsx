import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

const statusOptions = [
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Down' },
  { value: 'maintenance', label: 'Maintenance' },
];

export default function CreateServiceForm({
  open,
  onClose,
  statusPageId,
  onServiceCreated,
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'operational',
    sort_order: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Service name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusPageId: statusPageId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
          sortOrder: parseInt(formData.sort_order) || 0,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const data = await res.json();
      console.log('Service created:', data.service);

      // Reset form
      setFormData({
        name: '',
        description: '',
        status: 'operational',
        sort_order: 0,
      });

      onServiceCreated?.(data.service);
      onClose();
    } catch (err) {
      console.error('Create service error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        name: '',
        description: '',
        status: 'operational',
        sort_order: 0,
      });
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Add Service</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            name="name"
            label="Service Name"
            value={formData.name}
            onChange={handleChange}
            fullWidth
            required
            margin="normal"
            disabled={loading}
            placeholder="e.g., API Server, Database, Website"
          />

          <TextField
            name="description"
            label="Description"
            value={formData.description}
            onChange={handleChange}
            fullWidth
            multiline
            rows={3}
            margin="normal"
            disabled={loading}
            placeholder="Optional description of this service"
          />

          <FormControl fullWidth margin="normal" disabled={loading}>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              onChange={handleChange}
              label="Status"
            >
              {statusOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            name="sort_order"
            label="Sort Order"
            type="number"
            value={formData.sort_order}
            onChange={handleChange}
            fullWidth
            margin="normal"
            disabled={loading}
            helperText="Lower numbers appear first (0 = top)"
          />
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
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={16} />
                Creating...
              </Box>
            ) : (
              'Create Service'
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
