'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Paper,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Sms as SmsIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

export default function OnCallTextingModal({ 
  open, 
  onClose, 
  onCallPerson, 
  userInfo 
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationSid, setConversationSid] = useState(null);
  const [error, setError] = useState(null);
  const [conversationLoading, setConversationLoading] = useState(true);
  
  const messagesEndRef = useRef(null);
  const textFieldRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus on text field when modal opens
  useEffect(() => {
    if (open && textFieldRef.current) {
      setTimeout(() => {
        textFieldRef.current.focus();
      }, 100);
    }
  }, [open]);

  // Initialize conversation when modal opens
  useEffect(() => {
    if (open && onCallPerson) {
      initializeConversation();
    } else if (!open) {
      // Reset state when modal closes
      setMessages([]);
      setNewMessage('');
      setConversationSid(null);
      setError(null);
      setConversationLoading(true);
    }
  }, [open, onCallPerson]);

  const initializeConversation = async () => {
    setConversationLoading(true);
    setError(null);

    // Debug: Log the on-call person data structure
    console.log('🔍 On-call person data:', onCallPerson);

    // Extract phone number from various possible locations
    const phoneNumber = onCallPerson.phone || 
                       onCallPerson.phone_number ||
                       onCallPerson.current_on_call_member?.phone ||
                       onCallPerson.current_on_call_member?.phone_number ||
                       onCallPerson.user_phone ||
                       onCallPerson.contact_phone;
    
    console.log('📱 Extracted phone number:', phoneNumber);
    
    if (!phoneNumber) {
      setError(
        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>
            No phone number configured for {onCallPerson.user_name || 'this person'}.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={async () => {
              // For testing: set your phone number
              try {
                const response = await fetch('/api/user/update-phone', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone: '+17073269485' })
                });
                if (response.ok) {
                  setError(null);
                  window.location.reload(); // Refresh to get updated data
                }
              } catch (error) {
                console.error('Failed to set phone:', error);
              }
            }}
          >
            Set Test Phone Number (+17073269485)
          </Button>
        </Box>
      );
      setConversationLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'findOrCreate',
          onCallPersonPhone: phoneNumber,
          onCallPersonName: onCallPerson.user_name || onCallPerson.current_on_call_member?.name
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initialize conversation');
      }

      const data = await response.json();
      setConversationSid(data.conversationSid);
      
      // Load existing messages
      await loadMessages(data.conversationSid);
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
      setError('Failed to start conversation. Please try again.');
    } finally {
      setConversationLoading(false);
    }
  };

  const loadMessages = async (convSid = conversationSid) => {
    if (!convSid) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/conversations/messages?conversationSid=${convSid}`);
      
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      setMessages(data.messages.reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error('Failed to load messages:', error);
      setError('Failed to load conversation history.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationSid || sending) return;

    setSending(true);
    const messageToSend = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    try {
      const response = await fetch('/api/conversations/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationSid,
          message: messageToSend
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Add the sent message to the local state immediately
      const newMsg = {
        sid: data.messageSid,
        body: data.body,
        author: data.author,
        dateCreated: data.dateCreated,
        index: data.index,
        isSent: true
      };
      
      setMessages(prev => [...prev, newMsg]);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message. Please try again.');
      setNewMessage(messageToSend); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const isMyMessage = (message) => {
    return message.author === userInfo?.email || message.author === userInfo?.identity;
  };

  if (!onCallPerson) {
    return null;
  }

  const personName = onCallPerson.user_name || onCallPerson.current_on_call_member?.name || 'On-Call Person';
  const personPhone = onCallPerson.phone || 
                     onCallPerson.phone_number ||
                     onCallPerson.current_on_call_member?.phone ||
                     onCallPerson.current_on_call_member?.phone_number ||
                     onCallPerson.user_phone ||
                     onCallPerson.contact_phone;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">{personName}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip 
                  icon={<SmsIcon />}
                  label={personPhone || 'No phone'}
                  size="small"
                  variant="outlined"
                />
                <Chip 
                  label="On-Call"
                  size="small"
                  color="success"
                  variant="filled"
                />
              </Stack>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Refresh messages">
              <IconButton 
                onClick={() => loadMessages()} 
                disabled={loading}
                size="small"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <Divider />

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ m: 2 }}
            action={
              <Button size="small" onClick={initializeConversation}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {conversationLoading ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            flex: 1,
            gap: 2
          }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Setting up conversation...
            </Typography>
          </Box>
        ) : (
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto', 
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1
          }}>
            {messages.length === 0 && !loading ? (
              <Box sx={{ 
                textAlign: 'center', 
                py: 4,
                color: 'text.secondary'
              }}>
                <SmsIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="body1" gutterBottom>
                  Start a conversation with {personName}
                </Typography>
                <Typography variant="body2">
                  Messages will appear here
                </Typography>
              </Box>
            ) : (
              messages.map((message, index) => {
                const isMine = isMyMessage(message);
                return (
                  <Box
                    key={message.sid || index}
                    sx={{
                      display: 'flex',
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                      mb: 1
                    }}
                  >
                    <Paper
                      elevation={1}
                      sx={{
                        p: 1.5,
                        maxWidth: '70%',
                        bgcolor: isMine ? 'primary.main' : 'grey.100',
                        color: isMine ? 'primary.contrastText' : 'text.primary',
                        borderRadius: 2,
                        borderTopRightRadius: isMine ? 1 : 2,
                        borderTopLeftRadius: isMine ? 2 : 1,
                      }}
                    >
                      <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                        {message.body}
                      </Typography>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end',
                        gap: 0.5,
                        mt: 0.5 
                      }}>
                        <TimeIcon sx={{ fontSize: 12, opacity: 0.7 }} />
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            opacity: 0.7,
                            fontSize: '0.7rem'
                          }}
                        >
                          {formatMessageTime(message.dateCreated)}
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                );
              })
            )}
            
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={20} />
              </Box>
            )}
            
            <div ref={messagesEndRef} />
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>
          <TextField
            ref={textFieldRef}
            fullWidth
            multiline
            maxRows={3}
            placeholder={`Message ${personName}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sending || conversationLoading || !conversationSid}
            variant="outlined"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
              }
            }}
          />
          <Button
            variant="contained"
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending || conversationLoading || !conversationSid}
            sx={{
              minWidth: 56,
              height: 40,
              borderRadius: 3,
              alignSelf: 'flex-end'
            }}
          >
            {sending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <SendIcon />
            )}
          </Button>
        </Box>
        
        <Typography variant="caption" color="text.secondary" align="center">
          Messages will be sent via SMS to {personPhone}
        </Typography>
      </DialogActions>
    </Dialog>
  );
}