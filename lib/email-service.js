/**
 * Edge Runtime Compatible Email Service for sending transactional emails via SendGrid API
 * Uses fetch instead of @sendgrid/mail SDK to avoid Node.js dependencies
 */
class EmailService {
  constructor() {
    // Initialize SendGrid with API key
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.warn('SENDGRID_API_KEY not found. Email functionality disabled.');
      this.enabled = false;
      return;
    }

    this.apiKey = apiKey;
    this.enabled = true;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@alert24.net';
    this.sendgridApiUrl = 'https://api.sendgrid.com/v3/mail/send';
    
    // Email delivery tracking and batching
    this.deliveryQueue = [];
    this.batchSize = 10;
    this.throttleDelay = 1000; // 1 second between batches
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds initial retry delay
  }

  /**
   * Check if email service is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Check SendGrid account status
   */
  async checkSendGridStatus() {
    if (!this.enabled) {
      return { valid: false, error: 'Email service not configured' };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/user/account', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const accountData = await response.json();
        return { 
          valid: true, 
          account: {
            type: accountData.type,
            reputation: accountData.reputation
          }
        };
      } else {
        const errorText = await response.text();
        return { 
          valid: false, 
          error: `SendGrid API error: ${response.status} - ${errorText}`,
          status: response.status 
        };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Send a raw email using SendGrid API with retry logic and delivery tracking
   */
  async sendEmail({
    to,
    subject,
    htmlContent,
    textContent,
    organizationBranding = null,
    organizationId = null,
    emailType = 'general',
    priority = 'normal',
  }) {
    if (!this.enabled) {
      console.log(
        `Email disabled - would send: ${subject} to ${to}\n${textContent}`
      );
      return { success: false, error: 'Email service not configured' };
    }

    const emailRecord = {
      id: crypto.randomUUID(),
      to,
      subject,
      organizationId,
      emailType,
      priority,
      attempts: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastAttemptAt: null,
      messageId: null,
      error: null,
    };

    return this._sendEmailWithRetry({
      ...emailRecord,
      htmlContent,
      textContent,
      organizationBranding,
    });
  }

  /**
   * Internal method to send email with retry logic
   */
  async _sendEmailWithRetry(emailRecord) {
    const { to, subject, htmlContent, textContent, organizationBranding } = emailRecord;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      emailRecord.attempts = attempt;
      emailRecord.lastAttemptAt = new Date().toISOString();
      
      try {
        // Customize sender name based on organization branding
        const fromName = organizationBranding?.name || 'Alert24';

        // SendGrid API v3 payload format
        const payload = {
          personalizations: [
            {
              to: [{ email: to }],
              subject: subject,
            },
          ],
          from: {
            email: this.fromEmail,
            name: fromName,
          },
          content: [
            {
              type: 'text/plain',
              value: textContent,
            },
            {
              type: 'text/html',
              value: htmlContent,
            },
          ],
          tracking_settings: {
            click_tracking: { enable: true },
            open_tracking: { enable: true },
            subscription_tracking: { enable: true },
          },
        };

        const response = await fetch(this.sendgridApiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `SendGrid API error: ${response.status} - ${errorText}`
          );
        }

        // Success
        const messageId = response.headers.get('x-message-id');
        emailRecord.status = 'sent';
        emailRecord.messageId = messageId;
        emailRecord.sentAt = new Date().toISOString();

        console.log(`Email sent successfully to ${to}: ${subject} (attempt ${attempt})`);
        
        // Log delivery record for tracking
        this._logDeliveryRecord(emailRecord);
        
        return {
          success: true,
          messageId,
          deliveryId: emailRecord.id,
          attempts: attempt,
        };
      } catch (error) {
        console.error(`Email sending failed (attempt ${attempt}):`, error);
        
        emailRecord.error = error.message;
        
        // Enhanced error handling for common SendGrid issues
        let errorMessage = error.message;
        if (error.message.includes('Maximum credits exceeded')) {
          errorMessage = 'SendGrid account has exceeded its sending limit. Please check your SendGrid account or upgrade your plan.';
        } else if (error.message.includes('401')) {
          errorMessage = 'SendGrid API key is invalid or expired. Please check your API key configuration.';
        } else if (error.message.includes('403')) {
          errorMessage = 'SendGrid API access denied. Check your API key permissions.';
        } else if (error.message.includes('Request entity too large')) {
          errorMessage = 'Email content is too large. Please reduce the email size.';
        }
        
        // Don't retry on certain errors
        if (error.message.includes('401') || error.message.includes('403') || 
            error.message.includes('Request entity too large')) {
          emailRecord.status = 'failed';
          this._logDeliveryRecord(emailRecord);
          return { 
            success: false, 
            error: errorMessage, 
            originalError: error.message,
            deliveryId: emailRecord.id,
            attempts: attempt,
          };
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    emailRecord.status = 'failed';
    this._logDeliveryRecord(emailRecord);
    
    return { 
      success: false, 
      error: `Failed to send email after ${this.maxRetries} attempts: ${emailRecord.error}`,
      deliveryId: emailRecord.id,
      attempts: this.maxRetries,
    };
  }

  /**
   * Log delivery record for tracking (in production, this would save to database)
   */
  _logDeliveryRecord(record) {
    // In a real implementation, this would save to a notifications table in the database
    // For now, we'll just log it
    console.log('Email delivery record:', {
      id: record.id,
      to: record.to,
      subject: record.subject,
      status: record.status,
      attempts: record.attempts,
      messageId: record.messageId,
      organizationId: record.organizationId,
      emailType: record.emailType,
      createdAt: record.createdAt,
      sentAt: record.sentAt,
      error: record.error,
    });
  }

  /**
   * Add email to queue for batch processing
   */
  queueEmail(emailData) {
    const queueItem = {
      id: crypto.randomUUID(),
      ...emailData,
      queuedAt: new Date().toISOString(),
      priority: emailData.priority || 'normal',
    };
    
    this.deliveryQueue.push(queueItem);
    
    // Sort queue by priority (critical > high > normal > low)
    this.deliveryQueue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
      return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
    });
    
    console.log(`Email queued: ${emailData.subject} (Priority: ${queueItem.priority})`);
    return queueItem.id;
  }

  /**
   * Process email queue in batches with throttling
   */
  async processBatchQueue() {
    if (this.deliveryQueue.length === 0) {
      return { processed: 0, failed: 0 };
    }

    console.log(`Processing email queue: ${this.deliveryQueue.length} emails pending`);
    
    let processed = 0;
    let failed = 0;
    
    // Process emails in batches to avoid overwhelming SendGrid
    while (this.deliveryQueue.length > 0) {
      const batch = this.deliveryQueue.splice(0, this.batchSize);
      
      console.log(`Processing batch of ${batch.length} emails`);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (emailData) => {
        try {
          const result = await this.sendEmail(emailData);
          if (result.success) {
            processed++;
          } else {
            failed++;
            console.error(`Batch email failed: ${emailData.subject}`, result.error);
          }
          return result;
        } catch (error) {
          failed++;
          console.error(`Batch email error: ${emailData.subject}`, error);
          return { success: false, error: error.message };
        }
      });
      
      await Promise.all(batchPromises);
      
      // Throttle between batches to respect rate limits
      if (this.deliveryQueue.length > 0) {
        console.log(`Waiting ${this.throttleDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.throttleDelay));
      }
    }
    
    console.log(`Batch processing complete: ${processed} sent, ${failed} failed`);
    return { processed, failed };
  }

  /**
   * Send bulk notifications with rate limiting
   */
  async sendBulkNotifications(notifications) {
    // Add all notifications to queue
    const queueIds = notifications.map(notification => this.queueEmail(notification));
    
    // Process the queue
    const result = await this.processBatchQueue();
    
    return {
      ...result,
      queueIds,
      totalQueued: notifications.length,
    };
  }

  /**
   * Get email delivery statistics
   */
  getDeliveryStats(organizationId = null, timeRange = '24h') {
    // In a real implementation, this would query the notifications database table
    // For now, return mock stats
    return {
      sent: 125,
      failed: 3,
      pending: 7,
      deliveryRate: 97.6,
      organizationId,
      timeRange,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Send organization invitation email
   */
  async sendInvitationEmail({
    toEmail,
    toName,
    organizationName,
    inviterName,
    role,
    invitationLink,
    expiresAt,
    organizationBranding = null,
    organizationId = null,
  }) {
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `You're invited to join ${organizationName} on Alert24`;

    const textContent = `
Hi ${toName || 'there'},

${inviterName} has invited you to join ${organizationName} as a ${role}.

Accept your invitation by clicking this link:
${invitationLink}

This invitation will expire on ${expiryDate}.

If you don't have an Alert24 account yet, you'll be able to sign up using your Google account when you accept the invitation.

Best regards,
The Alert24 Team
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${organizationName} on Alert24</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px 40px; 
            text-align: center; 
        }
        .content { 
            padding: 40px; 
        }
        .button { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 20px 0; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px 40px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
        .role-badge { 
            background: #e3f2fd; 
            color: #1976d2; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 14px; 
            font-weight: 500; 
        }
        .org-logo { 
            max-height: 40px; 
            max-width: 200px; 
            margin-bottom: 10px; 
        }
        .unsubscribe {
            font-size: 12px;
            color: #999;
            margin-top: 10px;
        }
        .unsubscribe a {
            color: #999;
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${organizationBranding?.logoUrl ? `<img src="${organizationBranding.logoUrl}" alt="${organizationName}" class="org-logo">` : ''}
            <h1 style="margin: 0; font-size: 24px;">You're Invited!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Join ${organizationName} on Alert24</p>
        </div>
        
        <div class="content">
            <p>Hi ${toName || 'there'},</p>
            
            <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> with the role of <span class="role-badge">${role}</span>.</p>
            
            <p>Alert24 is an incident management and monitoring platform that helps teams track service health, manage incidents, and communicate with stakeholders during outages.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationLink}" class="button">Accept Invitation</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                This invitation will expire on <strong>${expiryDate}</strong>.
            </p>
            
            <p style="font-size: 14px; color: #666;">
                If you don't have an Alert24 account yet, you'll be able to sign up using your Google account when you accept the invitation.
            </p>
        </div>
        
        <div class="footer">
            <p>This email was sent by Alert24 on behalf of ${organizationName}.</p>
            <p>If you received this email by mistake, you can safely ignore it.</p>
            <div class="unsubscribe">
                <a href="{{unsubscribe}}">Unsubscribe</a> from invitation emails
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: toEmail,
      subject,
      htmlContent,
      textContent,
      organizationBranding,
      organizationId,
      emailType: 'invitation',
      priority: 'high',
    });
  }

  /**
   * Send incident notification email
   */
  async sendIncidentNotification({
    toEmail,
    toName,
    organizationName,
    incidentTitle,
    incidentDescription,
    severity,
    status,
    incidentUrl,
    organizationBranding = null,
    organizationId = null,
  }) {
    const severityColors = {
      critical: '#d32f2f',
      high: '#f57c00',
      medium: '#1976d2',
      low: '#388e3c',
      maintenance: '#7b1fa2',
    };

    const statusLabels = {
      open: 'New Incident',
      investigating: 'Investigating',
      identified: 'Issue Identified',
      monitoring: 'Monitoring',
      resolved: 'Resolved',
    };

    const subject = `[${severity.toUpperCase()}] ${statusLabels[status]}: ${incidentTitle}`;

    const textContent = `
${statusLabels[status].toUpperCase()}

Incident: ${incidentTitle}
Severity: ${severity.toUpperCase()}
Organization: ${organizationName}

Description:
${incidentDescription}

View the full incident details and updates:
${incidentUrl}

This is an automated notification from Alert24.
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Incident Alert: ${incidentTitle}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: ${severityColors[severity] || '#666'}; 
            color: white; 
            padding: 30px 40px; 
            text-align: center; 
        }
        .content { 
            padding: 40px; 
        }
        .incident-details { 
            background: #f8f9fa; 
            border: 1px solid #e9ecef; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
        }
        .button { 
            display: inline-block; 
            background: ${severityColors[severity] || '#666'}; 
            color: white; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 20px 0; 
        }
        .severity-badge { 
            background: ${severityColors[severity] || '#666'}; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold; 
            text-transform: uppercase; 
        }
        .status-badge { 
            background: #e3f2fd; 
            color: #1976d2; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: 500; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px 40px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">⚠️ ${statusLabels[status]}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${organizationName}</p>
        </div>
        
        <div class="content">
            <h2 style="margin-top: 0; color: ${severityColors[severity] || '#666'};">${incidentTitle}</h2>
            
            <div style="margin: 20px 0;">
                <span class="severity-badge">${severity}</span>
                <span class="status-badge">${statusLabels[status]}</span>
            </div>
            
            <div class="incident-details">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Description</h3>
                <p style="margin: 0; white-space: pre-wrap;">${incidentDescription}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${incidentUrl}" class="button">View Incident Details</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                You're receiving this notification because you're part of the ${organizationName} incident response team.
            </p>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from Alert24.</p>
            <p>To manage your notification preferences, visit your account settings.</p>
            <div class="unsubscribe" style="font-size: 12px; color: #999; margin-top: 10px;">
                <a href="{{unsubscribe}}" style="color: #999; text-decoration: underline;">Unsubscribe</a> from incident notifications
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: toEmail,
      subject,
      htmlContent,
      textContent,
      organizationBranding,
      organizationId,
      emailType: 'incident',
      priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'normal',
    });
  }

  /**
   * Send monitoring alert email
   */
  async sendMonitoringAlert({
    toEmail,
    toName,
    organizationName,
    serviceName,
    checkName,
    alertType, // 'down', 'up', 'degraded'
    errorMessage,
    responseTime,
    checkUrl,
    organizationBranding = null,
    organizationId = null,
  }) {
    const alertConfig = {
      down: {
        subject: `🔴 Service Down: ${serviceName}`,
        color: '#d32f2f',
        icon: '🔴',
        statusText: 'DOWN',
      },
      up: {
        subject: `✅ Service Recovered: ${serviceName}`,
        color: '#4caf50',
        icon: '✅',
        statusText: 'RECOVERED',
      },
      degraded: {
        subject: `⚠️ Service Degraded: ${serviceName}`,
        color: '#ff9800',
        icon: '⚠️',
        statusText: 'DEGRADED',
      },
    };

    const config = alertConfig[alertType] || alertConfig.down;

    const textContent = `
${config.statusText}: ${serviceName}

Check: ${checkName}
Organization: ${organizationName}
${responseTime ? `Response Time: ${responseTime}ms` : ''}
${errorMessage ? `Error: ${errorMessage}` : ''}

This is an automated monitoring alert from Alert24.
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.subject}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: ${config.color}; 
            color: white; 
            padding: 30px 40px; 
            text-align: center; 
        }
        .content { 
            padding: 40px; 
        }
        .alert-details { 
            background: #f8f9fa; 
            border: 1px solid #e9ecef; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px 40px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">${config.icon} ${config.statusText}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${serviceName}</p>
        </div>
        
        <div class="content">
            <h2 style="margin-top: 0;">${checkName}</h2>
            
            <div class="alert-details">
                <p><strong>Service:</strong> ${serviceName}</p>
                <p><strong>Organization:</strong> ${organizationName}</p>
                ${responseTime ? `<p><strong>Response Time:</strong> ${responseTime}ms</p>` : ''}
                ${errorMessage ? `<p><strong>Error:</strong> ${errorMessage}</p>` : ''}
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                This is an automated monitoring alert. Please check your service status and take appropriate action if needed.
            </p>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from Alert24.</p>
            <p>Monitoring powered by ${organizationName}</p>
            <div class="unsubscribe" style="font-size: 12px; color: #999; margin-top: 10px;">
                <a href="{{unsubscribe}}" style="color: #999; text-decoration: underline;">Unsubscribe</a> from monitoring alerts
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: toEmail,
      subject: config.subject,
      htmlContent,
      textContent,
      organizationBranding,
      organizationId,
      emailType: 'monitoring',
      priority: alertType === 'down' ? 'critical' : alertType === 'degraded' ? 'high' : 'normal',
    });
  }
}

// Create a singleton instance
export const emailService = new EmailService();

// Export the class for testing
export { EmailService };
