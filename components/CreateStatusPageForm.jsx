import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

// Function to generate slug from name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

export default function CreateStatusPageForm({ orgId, onSuccess, onCancel }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orgData, setOrgData] = useState(null);

  // Fetch organization data to get domain info
  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const res = await fetch(`/api/organizations/${orgId}`);
        if (res.ok) {
          const data = await res.json();
          setOrgData(data.organization);
        }
      } catch (err) {
        console.error('Failed to fetch org data:', err);
      }
    };
    if (orgId) fetchOrgData();
  }, [orgId]);

  // Auto-generate slug when name changes
  useEffect(() => {
    if (name) {
      setSlug(generateSlug(name));
    }
  }, [name]);

  // Generate the preview URL based on org domain/subdomain
  const getPreviewUrl = () => {
    if (!orgData) return 'your-domain.com/status/' + (slug || 'your-slug');
    
    if (orgData.domain) {
      return `${orgData.domain}/status/${slug || 'your-slug'}`;
    } else if (orgData.subdomain) {
      return `${orgData.subdomain}.yourdomain.com/status/${slug || 'your-slug'}`;
    } else {
      return `${orgData.slug}.yourdomain.com/status/${slug || 'your-slug'}`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name || !slug) {
      setError('Name and slug are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/status-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          name,
          slug,
          description,
          is_public: isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create status page');
      onSuccess && onSuccess(data.statusPage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Create Status Page</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Status Page Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
            margin="normal"
            autoFocus
            helperText="A descriptive name for your status page"
          />
          <TextField
            label="URL Slug"
            value={slug}
            onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
            fullWidth
            required
            margin="normal"
            helperText="This will be part of your status page URL (auto-generated from name)"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Your status page will be available at: <strong>{getPreviewUrl()}</strong>
          </Typography>
          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            minRows={2}
            helperText="Optional description of what this status page covers"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                color="primary"
              />
            }
            label="Publicly visible"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Status Page'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
} 