import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const StatusPageList = forwardRef(function StatusPageList({ orgId, onSelectStatusPage }, ref) {
  const [statusPages, setStatusPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchStatusPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/status-pages?org_id=${orgId}`);
      console.log('Status pages API response:', res.status, res.statusText);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Status pages API error:', errorData);
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      console.log('Status pages data:', data);
      setStatusPages(data.statusPages || []);
    } catch (err) {
      console.error('Fetch status pages error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({ fetchStatusPages }));

  useEffect(() => {
    if (orgId) fetchStatusPages();
  }, [orgId]);

  const getStatusPageUrl = (statusPage) => {
    // For now, we'll use the current domain with the slug
    // In production, this would use the organization's custom domain or subdomain
    const currentDomain = window.location.origin;
    return `${currentDomain}/status/${statusPage.slug}`;
  };

  const handleCopyUrl = async (statusPage, event) => {
    event.stopPropagation(); // Prevent status page selection
    try {
      const url = getStatusPageUrl(statusPage);
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = getStatusPageUrl(statusPage);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
    }
  };

  const handleOpenUrl = (statusPage, event) => {
    event.stopPropagation(); // Prevent status page selection
    const url = getStatusPageUrl(statusPage);
    window.open(url, '_blank');
  };

  return (
    <Box>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && statusPages.length === 0 && (
        <Typography color="text.secondary">
          No status pages yet. Click the "Create Status Page" button above to get started.
        </Typography>
      )}
      {!loading && !error && statusPages.length > 0 && (
        <List>
          {statusPages.map((sp) => (
            <ListItem key={sp.id} divider disablePadding>
              <ListItemButton 
                onClick={() => onSelectStatusPage?.(sp)}
                sx={{ py: 2, pr: 12 }} // Add right padding for buttons
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="body1">{sp.name}</Typography>
                      <Chip 
                        label={sp.is_public ? 'Public' : 'Private'} 
                        size="small"
                        color={sp.is_public ? 'success' : 'default'}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      {sp.description && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {sp.description}
                        </Typography>
                      )}
                      <Typography 
                        variant="caption" 
                        color="primary" 
                        sx={{ 
                          fontFamily: 'monospace',
                          backgroundColor: 'rgba(25, 118, 210, 0.08)',
                          padding: '2px 6px',
                          borderRadius: 1,
                          display: 'inline-block'
                        }}
                      >
                        {getStatusPageUrl(sp)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItemButton>
              <ListItemSecondaryAction>
                <Box display="flex" gap={0.5}>
                  <IconButton 
                    size="small"
                    onClick={(e) => handleCopyUrl(sp, e)}
                    title="Copy URL"
                    color="primary"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small"
                    onClick={(e) => handleOpenUrl(sp, e)}
                    title="Open in new tab"
                    color="primary"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
      
      {/* Copy success notification */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={() => setCopySuccess(false)}
        message="URL copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
});

export default StatusPageList; 