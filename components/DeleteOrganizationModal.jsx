import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import WarningIcon from '@mui/icons-material/Warning';

export default function DeleteOrganizationModal({
  open,
  onClose,
  organization,
  onOrganizationDeleted,
}) {
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isConfirmationValid = confirmationText === organization?.name;

  const handleDelete = async () => {
    if (!isConfirmationValid) {
      setError('Please type the organization name exactly as shown');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/organizations/${organization.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const data = await res.json();
      console.log('Organization deleted:', data);

      // Reset form
      setConfirmationText('');
      onOrganizationDeleted?.(organization);
      onClose();
    } catch (err) {
      console.error('Delete organization error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setConfirmationText('');
      setError(null);
      onClose();
    }
  };

  if (!organization) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1} color="error.main">
          <WarningIcon />
          Delete Organization
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            This action cannot be undone!
          </Typography>
          <Typography variant="body2">
            Deleting this organization will permanently remove:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            <li>All organization members</li>
            <li>All status pages</li>
            <li>All services and dependencies</li>
            <li>All organization data</li>
          </Box>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" gutterBottom>
          To confirm deletion, please type the organization name:
        </Typography>

        <Typography
          variant="body1"
          fontWeight="bold"
          sx={{
            p: 1,
            bgcolor: 'grey.100',
            borderRadius: 1,
            fontFamily: 'monospace',
            mb: 2,
          }}
        >
          {organization.name}
        </Typography>

        <TextField
          value={confirmationText}
          onChange={e => setConfirmationText(e.target.value)}
          placeholder="Type organization name here"
          fullWidth
          disabled={loading}
          error={confirmationText.length > 0 && !isConfirmationValid}
          helperText={
            confirmationText.length > 0 && !isConfirmationValid
              ? 'Organization name does not match'
              : ''
          }
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={loading || !isConfirmationValid}
        >
          {loading ? (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={16} />
              Deleting...
            </Box>
          ) : (
            'Delete Organization'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
