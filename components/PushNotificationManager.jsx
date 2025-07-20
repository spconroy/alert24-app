'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Delete as DeleteIcon,
  TestTube as TestIcon,
  Smartphone as SmartphoneIcon,
  Computer as ComputerIcon,
  Tablet as TabletIcon
} from '@mui/icons-material';
import PushNotificationClient from '../lib/push-notification-client';

const PushNotificationManager = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [testDialog, setTestDialog] = useState(false);
  const [pushClient, setPushClient] = useState(null);

  useEffect(() => {
    const client = new PushNotificationClient();
    setPushClient(client);
    setIsSupported(client.isSupported);
    
    if (client.isSupported) {
      loadSubscriptionStatus();
      client.setupMessageListener();
    } else {
      setLoading(false);
    }
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subscribed, userSubscriptions] = await Promise.all([
        pushClient?.isSubscribed() || false,
        pushClient?.getUserSubscriptions() || []
      ]);

      setIsSubscribed(subscribed);
      setSubscriptions(userSubscriptions);
    } catch (err) {
      console.error('Failed to load subscription status:', err);
      setError('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await pushClient.subscribe();
      
      setIsSubscribed(true);
      setSuccess('Push notifications enabled successfully!');
      
      // Reload subscriptions
      await loadSubscriptionStatus();
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError(err.message || 'Failed to enable push notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await pushClient.unsubscribe();
      
      setIsSubscribed(false);
      setSuccess('Push notifications disabled successfully!');
      
      // Reload subscriptions
      await loadSubscriptionStatus();
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      setError(err.message || 'Failed to disable push notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubscription = async (subscriptionId) => {
    try {
      setError(null);
      
      const response = await fetch(`/api/notifications/push?id=${subscriptionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete subscription');
      }

      setSuccess('Device removed successfully!');
      
      // Reload subscriptions
      await loadSubscriptionStatus();
    } catch (err) {
      console.error('Failed to delete subscription:', err);
      setError(err.message || 'Failed to remove device');
    }
  };

  const handleTestNotification = async () => {
    try {
      setError(null);
      
      const result = await pushClient.sendTestNotification();
      
      setSuccess(`Test notification sent! Success rate: ${result.stats.successRate.toFixed(1)}%`);
      setTestDialog(false);
    } catch (err) {
      console.error('Failed to send test notification:', err);
      setError(err.message || 'Failed to send test notification');
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile':
        return <SmartphoneIcon />;
      case 'tablet':
        return <TabletIcon />;
      default:
        return <ComputerIcon />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Push Notifications Not Supported
            </Typography>
            <Typography>
              Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, Safari, or Edge.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <NotificationsIcon color="primary" />
            <Typography variant="h6">
              Push Notifications
            </Typography>
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            {isSubscribed && (
              <Button
                startIcon={<TestIcon />}
                onClick={() => setTestDialog(true)}
                variant="outlined"
                size="small"
              >
                Test
              </Button>
            )}
            
            <FormControlLabel
              control={
                <Switch
                  checked={isSubscribed}
                  onChange={isSubscribed ? handleUnsubscribe : handleSubscribe}
                  disabled={loading}
                />
              }
              label={isSubscribed ? 'Enabled' : 'Disabled'}
            />
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" paragraph>
          Receive real-time notifications for incidents, alerts, and important updates even when the app is closed.
        </Typography>

        {loading && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        )}

        {!loading && subscriptions.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              Registered Devices ({subscriptions.length})
            </Typography>
            
            <List>
              {subscriptions.map((subscription) => (
                <ListItem key={subscription.id} divider>
                  <Box display="flex" alignItems="center" gap={1} mr={2}>
                    {getDeviceIcon(subscription.device_type)}
                  </Box>
                  
                  <ListItemText
                    primary={subscription.device_name}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {subscription.browser} • Last used: {formatDate(subscription.last_used)}
                        </Typography>
                        <Box mt={0.5}>
                          <Chip
                            label={subscription.is_active ? 'Active' : 'Inactive'}
                            color={subscription.is_active ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                      </Box>
                    }
                  />
                  
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteSubscription(subscription.id)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </>
        )}

        {!loading && !isSubscribed && (
          <Box textAlign="center" p={2}>
            <NotificationsOffIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Enable push notifications to stay updated with real-time alerts
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Test Notification Dialog */}
      <Dialog open={testDialog} onClose={() => setTestDialog(false)}>
        <DialogTitle>Send Test Notification</DialogTitle>
        <DialogContent>
          <Typography>
            This will send a test push notification to this device to verify that everything is working correctly.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleTestNotification} variant="contained">
            Send Test
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PushNotificationManager;