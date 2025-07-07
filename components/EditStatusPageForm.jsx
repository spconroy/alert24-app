import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Alert,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Function to generate slug from name
const generateSlug = name => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

export default function EditStatusPageForm({
  open,
  onClose,
  statusPage,
  onStatusPageUpdated,
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Initialize form with statusPage data when modal opens
  useEffect(() => {
    if (open && statusPage) {
      setName(statusPage.name || '');
      setSlug(statusPage.slug || '');
      setDescription(statusPage.description || '');
      setIsPublic(statusPage.is_public ?? true);
      setSlugManuallyEdited(false);
      setError(null);
    }
  }, [open, statusPage]);

  // Auto-generate slug when name changes (only if slug hasn't been manually edited)
  useEffect(() => {
    if (name && !slugManuallyEdited) {
      setSlug(generateSlug(name));
    }
  }, [name, slugManuallyEdited]);

  const handleSlugChange = e => {
    setSlug(e.target.value);
    setSlugManuallyEdited(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);

    if (!name || !slug) {
      setError('Name and slug are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/status-pages/${statusPage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description,
          is_public: isPublic,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status page');
      }

      // Call the callback to update the parent component
      if (onStatusPageUpdated) {
        onStatusPageUpdated(data.statusPage);
      }

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit Status Page</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Status Page Name"
            value={name}
            onChange={e => setName(e.target.value)}
            margin="normal"
            required
            placeholder="Enter the name for your status page"
          />

          <TextField
            fullWidth
            label="Slug"
            value={slug}
            onChange={handleSlugChange}
            margin="normal"
            required
            placeholder="url-friendly-name"
            helperText="This will be used in the URL: /status/your-slug"
          />

          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            margin="normal"
            multiline
            rows={3}
            placeholder="Optional description of your status page"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                color="primary"
              />
            }
            label="Make this status page public"
            sx={{ mt: 2 }}
          />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Public status pages can be viewed by anyone with the URL. Private
            pages require authentication.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !name || !slug}
          >
            {loading ? 'Updating...' : 'Update Status Page'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
