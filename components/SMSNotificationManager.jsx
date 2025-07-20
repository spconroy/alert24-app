'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
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
  Divider,
  InputAdornment,
  Grid,
  Paper
} from '@mui/material';
import {
  Sms as SmsIcon,
  SmsOutlined as SmsOutlinedIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Verified as VerifiedIcon,
  Warning as WarningIcon,
  Send as SendIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';

const SMSNotificationManager = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Add phone number dialog
  const [addDialog, setAddDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addingPhone, setAddingPhone] = useState(false);
  
  // Verification dialog
  const [verifyDialog, setVerifyDialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  
  // Test SMS dialog
  const [testDialog, setTestDialog] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/notifications/sms');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load SMS contacts');
      }

      setContacts(data.contacts || []);
    } catch (err) {
      console.error('Failed to load SMS contacts:', err);
      setError(err.message || 'Failed to load SMS contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoneNumber = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    try {
      setAddingPhone(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/notifications/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add phone number');
      }

      setSuccess(data.message);
      setPhoneNumber('');
      setAddDialog(false);
      
      if (data.requiresVerification) {
        // Send verification code
        await sendVerificationCode(phoneNumber.trim());
      }
      
      await loadContacts();
    } catch (err) {
      console.error('Failed to add phone number:', err);
      setError(err.message || 'Failed to add phone number');
    } finally {
      setAddingPhone(false);
    }
  };

  const sendVerificationCode = async (phone) => {
    try {
      const response = await fetch('/api/notifications/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phone,
          isVerification: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setPendingVerification(phone);
      setVerifyDialog(true);
      setSuccess('Verification code sent! Please check your phone.');
    } catch (err) {
      console.error('Failed to send verification code:', err);
      setError(err.message || 'Failed to send verification code');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setVerifyingCode(true);
      setError(null);

      const response = await fetch('/api/notifications/sms/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: pendingVerification,
          verificationCode: verificationCode.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify code');
      }

      setSuccess('Phone number verified successfully!');
      setVerificationCode('');
      setVerifyDialog(false);
      setPendingVerification(null);
      
      await loadContacts();
    } catch (err) {
      console.error('Failed to verify code:', err);
      setError(err.message || 'Failed to verify code');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      setError(null);
      
      const response = await fetch(`/api/notifications/sms?id=${contactId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove phone number');
      }

      setSuccess('Phone number removed successfully!');
      await loadContacts();
    } catch (err) {
      console.error('Failed to delete contact:', err);
      setError(err.message || 'Failed to remove phone number');
    }
  };

  const handleSendTest = async () => {
    try {
      setSendingTest(true);
      setError(null);

      const response = await fetch('/api/notifications/sms/send', {
        method: 'GET'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test SMS');
      }

      setSuccess(`Test SMS sent! Success rate: ${data.stats.successRate.toFixed(1)}%`);
      setTestDialog(false);
    } catch (err) {
      console.error('Failed to send test SMS:', err);
      setError(err.message || 'Failed to send test SMS');
    } finally {
      setSendingTest(false);
    }
  };

  const formatPhoneNumber = (phone) => {
    // Simple phone number formatting
    if (phone.startsWith('+1') && phone.length === 12) {
      return `+1 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  const getStatusChip = (contact) => {
    if (contact.is_verified) {
      return (
        <Chip
          icon={<VerifiedIcon />}
          label="Verified"
          color="success"
          size="small"
        />
      );
    } else {
      return (
        <Chip
          icon={<WarningIcon />}
          label="Unverified"
          color="warning"
          size="small"
        />
      );
    }
  };

  const hasVerifiedContacts = contacts.some(c => c.is_verified);

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <SmsIcon color="primary" />
            <Typography variant="h6">
              SMS Notifications
            </Typography>
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            {hasVerifiedContacts && (
              <Button
                startIcon={<SendIcon />}
                onClick={() => setTestDialog(true)}
                variant="outlined"
                size="small"
              >
                Test
              </Button>
            )}
            
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddDialog(true)}
              variant="contained"
              size="small"
            >
              Add Phone
            </Button>
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
          Receive SMS notifications for critical incidents and alerts. Phone numbers must be verified before receiving notifications.
        </Typography>

        {loading && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        )}

        {!loading && contacts.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              Phone Numbers ({contacts.length})
            </Typography>
            
            <List>
              {contacts.map((contact) => (
                <ListItem key={contact.id} divider>
                  <Box display="flex" alignItems="center" gap={1} mr={2}>
                    <PhoneIcon color="action" />
                  </Box>
                  
                  <ListItemText
                    primary={formatPhoneNumber(contact.contact_value)}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          Added: {new Date(contact.created_at).toLocaleDateString()}
                          {contact.verified_at && (
                            <>
                              {' • '}
                              Verified: {new Date(contact.verified_at).toLocaleDateString()}
                            </>
                          )}
                        </Typography>
                        <Box mt={0.5}>
                          {getStatusChip(contact)}
                          {!contact.is_verified && (
                            <Button
                              size="small"
                              onClick={() => sendVerificationCode(contact.contact_value)}
                              sx={{ ml: 1 }}
                            >
                              Send Code
                            </Button>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                  
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteContact(contact.id)}
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

        {!loading && contacts.length === 0 && (
          <Box textAlign="center" p={4}>
            <SmsOutlinedIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No phone numbers added yet
            </Typography>
          </Box>
        )}

        {!loading && !hasVerifiedContacts && contacts.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            You have unverified phone numbers. Please verify them to receive SMS notifications.
          </Alert>
        )}
      </CardContent>

      {/* Add Phone Number Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Phone Number</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Phone Number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 123-4567"
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon />
                </InputAdornment>
              ),
            }}
            helperText="Include country code (e.g., +1 for US/Canada)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddPhoneNumber} 
            variant="contained"
            disabled={addingPhone}
          >
            {addingPhone ? <CircularProgress size={20} /> : 'Add Phone'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Verification Dialog */}
      <Dialog open={verifyDialog} onClose={() => setVerifyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Verify Phone Number</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            We've sent a 6-digit verification code to {formatPhoneNumber(pendingVerification || '')}.
            Please enter the code below:
          </Typography>
          <TextField
            fullWidth
            label="Verification Code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            margin="normal"
            inputProps={{ maxLength: 6 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleVerifyCode} 
            variant="contained"
            disabled={verifyingCode || verificationCode.length !== 6}
          >
            {verifyingCode ? <CircularProgress size={20} /> : 'Verify'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test SMS Dialog */}
      <Dialog open={testDialog} onClose={() => setTestDialog(false)}>
        <DialogTitle>Send Test SMS</DialogTitle>
        <DialogContent>
          <Typography>
            This will send a test SMS to all your verified phone numbers to ensure notifications are working correctly.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendTest} 
            variant="contained"
            disabled={sendingTest}
          >
            {sendingTest ? <CircularProgress size={20} /> : 'Send Test'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default SMSNotificationManager;