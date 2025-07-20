/**
 * Comprehensive Notification Service
 * Handles all types of notifications: email, SMS, phone calls, and push notifications
 */

import SMSService from './sms-service.js';

class NotificationService {
  constructor() {
    this.smsService = new SMSService();
  }

  /**
   * Send notification through specified channels
   */
  async sendNotification(notification) {
    const {
      channels = ['email'],
      recipient,
      subject,
      message,
      incidentData,
      priority = 'normal',
      organizationId
    } = notification;

    const results = {
      success: false,
      channels: {},
      errors: []
    };

    // Send through each requested channel
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            results.channels.email = await this.sendEmail({
              to: recipient.email,
              subject,
              message,
              incidentData,
              organizationId
            });
            break;

          case 'sms':
            if (recipient.phone) {
              results.channels.sms = await this.sendSMS({
                to: recipient.phone,
                message: this.formatSMSMessage(subject, message, incidentData),
                priority
              });
            } else {
              results.channels.sms = { success: false, error: 'No phone number available' };
            }
            break;

          case 'call':
            if (recipient.phone) {
              results.channels.call = await this.makePhoneCall({
                to: recipient.phone,
                message: this.formatCallMessage(subject, message, incidentData),
                priority
              });
            } else {
              results.channels.call = { success: false, error: 'No phone number available' };
            }
            break;

          case 'slack':
            // TODO: Implement Slack notifications
            results.channels.slack = { success: false, error: 'Slack integration not implemented' };
            break;

          default:
            results.errors.push(`Unknown channel: ${channel}`);
        }
      } catch (error) {
        console.error(`Error sending ${channel} notification:`, error);
        results.channels[channel] = { success: false, error: error.message };
        results.errors.push(`${channel}: ${error.message}`);
      }
    }

    // Determine overall success
    const successfulChannels = Object.values(results.channels).filter(r => r.success).length;
    results.success = successfulChannels > 0;

    return results;
  }

  /**
   * Send email notification
   */
  async sendEmail({ to, subject, message, incidentData, organizationId }) {
    try {
      // Import email service dynamically to avoid edge runtime issues
      const { emailService } = await import('./email-service');
      
      // Check if email service is enabled
      if (!emailService.isEnabled()) {
        console.warn('Email service not configured - missing SENDGRID_API_KEY');
        return { success: false, error: 'Email service not configured' };
      }
      
      // If we have incident data, use the proper incident notification method
      if (incidentData) {
        return await emailService.sendIncidentNotification({
          toEmail: to,
          toName: 'User', // We don't have the recipient name in this context
          organizationName: incidentData.organizationName || 'Alert24',
          incidentTitle: incidentData.title || subject,
          incidentDescription: message,
          severity: incidentData.severity || 'medium',
          status: incidentData.status || 'open',
          incidentUrl: incidentData.url || `${process.env.NEXT_PUBLIC_APP_URL}/incidents/${incidentData.id}`,
          organizationId
        });
      } else {
        // For general notifications, use a simpler email sending method
        return await emailService.sendEmail({
          to: to,
          subject: subject,
          textContent: message,
          htmlContent: `<p>${message.replace(/\n/g, '<br>')}</p>`
        });
      }
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS({ to, message, priority = 'normal' }) {
    try {
      return await this.smsService.sendSMS(to, message, {
        priority,
        validityPeriod: priority === 'high' ? 3600 : 86400 // 1 hour for high priority, 24 hours for normal
      });
    } catch (error) {
      console.error('SMS sending failed:', error);
      // Check if it's a Twilio blocking issue
      if (error.message.includes('blocked') || error.message.includes('suspended')) {
        console.warn('⚠️ Twilio account appears to be blocked or suspended');
        return { success: false, error: 'SMS service temporarily unavailable - account blocked' };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Make phone call notification
   */
  async makePhoneCall({ to, message, priority = 'normal' }) {
    try {
      // Validate Twilio configuration
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !twilioPhoneNumber) {
        throw new Error('Twilio configuration incomplete for phone calls');
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(to);

      // Create TwiML for the call based on priority
      const twimlMessage = this.createCallTwiML(message, priority);

      // Make Twilio API call
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
      
      const payload = new URLSearchParams({
        To: formattedPhone,
        From: twilioPhoneNumber,
        Twiml: twimlMessage,
        MaxPrice: priority === 'high' ? '1.00' : '0.50', // Higher price limit for critical calls
        StatusCallback: `${process.env.NEXTAUTH_URL || 'https://alert24.app'}/api/webhooks/twilio/call-status`
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: payload.toString()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to make call');
      }

      return {
        success: true,
        callId: data.sid,
        status: data.status,
        to: data.to,
        from: data.from,
        timestamp: new Date().toISOString(),
        provider: 'twilio'
      };

    } catch (error) {
      console.error('Phone call failed:', error);
      // Check if it's a Twilio blocking issue
      if (error.message.includes('blocked') || error.message.includes('suspended') || error.message.includes('forbidden')) {
        console.warn('⚠️ Twilio account appears to be blocked or suspended for calls');
        return { success: false, error: 'Phone service temporarily unavailable - account blocked' };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Format phone number for Twilio
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Check if it starts with + and has country code
    if (cleaned.startsWith('+') && cleaned.length >= 10 && cleaned.length <= 15) {
      return cleaned;
    }
    
    // Try to add default country code if missing
    if (!cleaned.startsWith('+') && cleaned.length === 10) {
      // Assume US/Canada if 10 digits
      return `+1${cleaned}`;
    }
    
    throw new Error('Invalid phone number format. Please include country code');
  }

  /**
   * Format message for SMS (160 character limit consideration)
   */
  formatSMSMessage(subject, message, incidentData) {
    const prefix = incidentData?.severity === 'critical' ? '🚨 CRITICAL: ' : '⚠️ ALERT: ';
    const shortMessage = `${prefix}${subject}. ${message}`;
    
    // Truncate if too long, keeping important info
    if (shortMessage.length > 160) {
      return shortMessage.substring(0, 157) + '...';
    }
    
    return shortMessage;
  }

  /**
   * Create TwiML for phone call based on priority and message
   */
  createCallTwiML(message, priority = 'normal') {
    const urgencyPrefix = priority === 'high' ? 'URGENT ALERT! This is a critical incident notification.' : 'Alert notification.';
    
    // Clean the message for voice synthesis
    const cleanMessage = message
      .replace(/[^\w\s.,!?-]/g, ' ') // Remove special characters except basic punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return `
      <Response>
        <Say voice="alice" language="en-US">
          ${urgencyPrefix}
          ${cleanMessage}
          Please check your monitoring dashboard for more details.
          This message will repeat once.
        </Say>
        <Pause length="2"/>
        <Say voice="alice" language="en-US">
          Repeating: ${cleanMessage}
          End of notification. Goodbye.
        </Say>
      </Response>
    `.trim();
  }

  /**
   * Format message for phone call
   */
  formatCallMessage(subject, message, incidentData) {
    // Keep it concise and clear for voice
    const priority = incidentData?.severity === 'critical' ? 'critical' : 'normal';
    const serviceInfo = incidentData?.serviceName ? ` affecting ${incidentData.serviceName}` : '';
    
    return `${subject}${serviceInfo}. ${message}`;
  }

  /**
   * Send notifications for escalation policy
   */
  async sendEscalationNotifications(escalationRule, incidentData, organizationId) {
    const results = [];

    for (const target of escalationRule.targets || []) {
      try {
        // Get user details for the target
        const recipient = await this.getRecipientDetails(target, organizationId);
        
        if (!recipient) {
          results.push({
            target,
            success: false,
            error: 'Recipient not found'
          });
          continue;
        }

        // Determine which channels to use based on escalation rule and user preferences
        const channels = this.determineNotificationChannels(
          escalationRule.notification_channels || ['email'],
          recipient.notification_preferences || {},
          incidentData.severity || 'normal'
        );

        const result = await this.sendNotification({
          channels,
          recipient,
          subject: `Incident Escalation: ${incidentData.title}`,
          message: this.createEscalationMessage(incidentData, escalationRule.level),
          incidentData,
          priority: incidentData.severity === 'critical' ? 'high' : 'normal',
          organizationId
        });

        results.push({
          target,
          recipient: recipient.email,
          ...result
        });

      } catch (error) {
        console.error(`Error sending escalation notification to ${target}:`, error);
        results.push({
          target,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get recipient details from user ID, team ID, or on-call schedule
   */
  async getRecipientDetails(target, organizationId) {
    try {
      // Dynamic import to avoid edge runtime issues
      const { db } = await import('./db-supabase');

      // Assume target is a user ID for now (could be enhanced for teams/schedules)
      const { data: user, error } = await db.client
        .from('users')
        .select(`
          id,
          email,
          name,
          phone_number,
          notification_preferences
        `)
        .eq('id', target)
        .single();

      if (error || !user) {
        console.warn(`User not found for target: ${target}`);
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone_number,
        notification_preferences: user.notification_preferences || {}
      };

    } catch (error) {
      console.error('Error fetching recipient details:', error);
      return null;
    }
  }

  /**
   * Determine which notification channels to use
   */
  determineNotificationChannels(requestedChannels, userPreferences, severity) {
    const channels = [];

    for (const channel of requestedChannels) {
      switch (channel) {
        case 'email':
          if (userPreferences.email_incidents || userPreferences.email_escalations) {
            channels.push('email');
          }
          break;

        case 'sms':
          if (severity === 'critical' && userPreferences.sms_critical) {
            channels.push('sms');
          } else if (userPreferences.sms_escalations) {
            channels.push('sms');
          }
          break;

        case 'call':
          if (severity === 'critical' && userPreferences.call_critical) {
            channels.push('call');
          } else if (userPreferences.call_escalations) {
            channels.push('call');
          }
          break;

        case 'slack':
          // TODO: Add Slack preference checks
          channels.push('slack');
          break;
      }
    }

    // Always include email as fallback if no other channels are enabled
    if (channels.length === 0) {
      channels.push('email');
    }

    return channels;
  }

  /**
   * Create escalation message
   */
  createEscalationMessage(incidentData, escalationLevel) {
    const {
      title,
      description,
      severity,
      serviceName,
      status,
      url
    } = incidentData;

    const levelText = escalationLevel > 1 ? ` (Escalation Level ${escalationLevel})` : '';
    
    return `
This incident has been escalated to you${levelText}:

Service: ${serviceName || 'Unknown'}
Status: ${status || 'Open'}
Severity: ${severity || 'Normal'}

${description || 'No additional details available.'}

Please review the incident dashboard for more information: ${url || 'N/A'}
    `.trim();
  }

  /**
   * Test notification delivery
   */
  async testNotification(channel, recipient, message = 'This is a test notification from Alert24.') {
    const testData = {
      channels: [channel],
      recipient,
      subject: 'Alert24 Test Notification',
      message,
      incidentData: {
        title: 'Test Notification',
        severity: 'normal'
      },
      priority: 'normal'
    };

    return await this.sendNotification(testData);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;