import sgMail from '@sendgrid/mail';

/**
 * Email Service for sending transactional emails via SendGrid
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

    sgMail.setApiKey(apiKey);
    this.enabled = true;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@alert24.io';
  }

  /**
   * Check if email service is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Send a raw email
   */
  async sendEmail({
    to,
    subject,
    htmlContent,
    textContent,
    organizationBranding = null,
  }) {
    if (!this.enabled) {
      console.log(
        `Email disabled - would send: ${subject} to ${to}\n${textContent}`
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Customize sender name based on organization branding
      const fromName = organizationBranding?.name || 'Alert24';
      const fromAddress = `${fromName} <${this.fromEmail}>`;

      const msg = {
        to,
        from: fromAddress,
        subject,
        text: textContent,
        html: htmlContent,
      };

      const response = await sgMail.send(msg);
      console.log(`Email sent successfully to ${to}: ${subject}`);
      return {
        success: true,
        messageId: response[0]?.headers?.['x-message-id'],
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
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
    });
  }
}

// Create a singleton instance
export const emailService = new EmailService();

// Export the class for testing
export { EmailService };
