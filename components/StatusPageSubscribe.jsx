'use client';
import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  NotificationsActive as NotificationsActiveIcon,
  Close as CloseIcon,
  Email as EmailIcon,
} from '@mui/icons-material';

export default function StatusPageSubscribe({ statusPageId, statusPageName }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleOpen = () => {
    setOpen(true);
    setSuccess(false);
    setError(null);
    setEmail('');
  };

  const handleClose = () => {
    setOpen(false);
    setEmail('');
    setError(null);
    setSuccess(false);
  };

  const handleSubscribe = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status_page_id: statusPageId,
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      setSuccess(true);
      setEmail('');

      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = event => {
    if (event.key === 'Enter' && !loading) {
      handleSubscribe();
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={<NotificationsActiveIcon />}
        onClick={handleOpen}
        sx={{
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
        }}
      >
        Subscribe to Updates
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box display="flex" alignItems="center" gap={1}>
              <EmailIcon color="primary" />
              <Typography variant="h6">Subscribe to Updates</Typography>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {success ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body1" fontWeight={600}>
                Successfully subscribed!
              </Typography>
              <Typography variant="body2">
                You'll receive email notifications when there are updates to{' '}
                {statusPageName}.
              </Typography>
            </Alert>
          ) : (
            <>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Get notified via email when there are incidents, maintenance, or
                other updates for <strong>{statusPageName}</strong>.
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <TextField
                fullWidth
                type="email"
                label="Email Address"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                autoFocus
                sx={{ mb: 2 }}
                helperText="We'll only send you important status updates"
              />
            </>
          )}
        </DialogContent>

        {!success && (
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleClose} disabled={loading} color="inherit">
              Cancel
            </Button>
            <Button
              onClick={handleSubscribe}
              variant="contained"
              disabled={loading || !email}
              startIcon={
                loading ? (
                  <CircularProgress size={16} />
                ) : (
                  <NotificationsActiveIcon />
                )
              }
            >
              {loading ? 'Subscribing...' : 'Subscribe'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
}
