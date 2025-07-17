import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useOrganization } from '@/contexts/OrganizationContext';
export default function CreateOrganizationForm({ onBack, onSuccess }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { session } = useOrganization();

  const handleChange = e => {
    const { name, value } = e.target;
    if (name === 'name') {
      setName(value);
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(slug);
    } else if (name === 'domain') {
      setDomain(value);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!session?.user?.id) {
      setError('You must be logged in to create an organization');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        slug,
        domain,
        userId: session?.user?.id,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Failed to create organization');
    } else {
      setSuccess(true);
      setName('');
      setSlug('');
      setDomain('');
      if (onSuccess) onSuccess(data.organization);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={3}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mr: 2 }}>
            Back
          </Button>
          <Typography variant="h5" component="h2">
            Create New Organization
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Organization created!
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Organization Name"
                name="name"
                value={name}
                onChange={handleChange}
                required
                disabled={loading}
                helperText="Enter a descriptive name for your organization. Organization name must be globally unique."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Slug"
                name="slug"
                value={slug}
                onChange={handleChange}
                required
                disabled={loading}
                helperText="URL-friendly identifier (auto-generated from name). Short unique identifier (e.g. acme-corp). Must be globally unique."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Custom Domain (Optional)"
                name="domain"
                value={domain}
                onChange={handleChange}
                disabled={loading}
                helperText="e.g., mycompany.alert24.com. Custom domain for your organization (optional, must be globally unique if used)"
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !name || !slug}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? 'Creating...' : 'Create Organization'}
                </Button>
                <Button variant="outlined" onClick={onBack} disabled={loading}>
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  );
}
