/**
 * Email Service Usage Examples
 * 
 * This file demonstrates how to use the email service in various parts of your application.
 * Copy and adapt these examples for your specific use cases.
 */

import { emailService } from '@/lib/email-service';

// Example 1: Send invitation email when user invites someone to organization
export async function sendOrganizationInvitation({
  inviteeEmail,
  inviteeName,
  organizationId,
  organizationName,
  inviterName,
  role,
  invitationToken,
  organizationBranding = null
}) {
  const invitationLink = `${process.env.NEXTAUTH_URL}/invitations/${invitationToken}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const result = await emailService.sendInvitationEmail({
    toEmail: inviteeEmail,
    toName: inviteeName,
    organizationName,
    inviterName,
    role,
    invitationLink,
    expiresAt,
    organizationBranding,
  });

  if (result.success) {
    console.log(`Invitation email sent to ${inviteeEmail} for ${organizationName}`);
  } else {
    console.error(`Failed to send invitation email: ${result.error}`);
  }

  return result;
}

// Example 2: Send incident notification to team members
export async function notifyIncidentToTeam({
  incidentId,
  incidentTitle,
  incidentDescription,
  severity,
  status,
  organizationId,
  organizationName,
  teamMembers,
  organizationBranding = null
}) {
  const incidentUrl = `${process.env.NEXTAUTH_URL}/incidents/${incidentId}`;
  const results = [];

  for (const member of teamMembers) {
    const result = await emailService.sendIncidentNotification({
      toEmail: member.email,
      toName: member.name,
      organizationName,
      incidentTitle,
      incidentDescription,
      severity,
      status,
      incidentUrl,
      organizationBranding,
    });

    results.push({
      email: member.email,
      success: result.success,
      error: result.error,
    });

    // Add delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

// Example 3: Send monitoring alert to on-call engineers
export async function sendMonitoringAlertToOnCall({
  serviceId,
  serviceName,
  checkName,
  alertType, // 'down', 'up', 'degraded'
  errorMessage,
  responseTime,
  organizationId,
  organizationName,
  onCallEngineers,
  organizationBranding = null
}) {
  const checkUrl = `${process.env.NEXTAUTH_URL}/monitoring/${serviceId}`;
  const results = [];

  for (const engineer of onCallEngineers) {
    const result = await emailService.sendMonitoringAlert({
      toEmail: engineer.email,
      toName: engineer.name,
      organizationName,
      serviceName,
      checkName,
      alertType,
      errorMessage,
      responseTime,
      checkUrl,
      organizationBranding,
    });

    results.push({
      email: engineer.email,
      success: result.success,
      error: result.error,
    });

    // Add delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

// Example 4: Batch email notifications with error handling
export async function sendBatchNotifications(emailJobs) {
  const results = [];
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  for (const job of emailJobs) {
    let attempts = 0;
    let result = null;

    while (attempts < maxRetries) {
      try {
        result = await emailService.sendEmail(job);
        
        if (result.success) {
          break; // Success, no need to retry
        } else {
          // Check if error is retryable
          if (result.error.includes('rate limit') || result.error.includes('timeout')) {
            attempts++;
            if (attempts < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
              continue;
            }
          } else {
            // Non-retryable error, break immediately
            break;
          }
        }
      } catch (error) {
        attempts++;
        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
        } else {
          result = { success: false, error: error.message };
        }
      }
    }

    results.push({
      ...job,
      result,
      attempts,
    });

    // Add delay between jobs to avoid overwhelming the service
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

// Example 5: Check email service health before sending critical notifications
export async function checkEmailServiceHealth() {
  if (!emailService.isEnabled()) {
    return {
      healthy: false,
      error: 'Email service not configured',
      recommendations: [
        'Set SENDGRID_API_KEY environment variable',
        'Set SENDGRID_FROM_EMAIL environment variable',
      ]
    };
  }

  try {
    const sendgridStatus = await emailService.checkSendGridStatus();
    
    if (!sendgridStatus.valid) {
      return {
        healthy: false,
        error: sendgridStatus.error,
        recommendations: [
          'Check SendGrid API key validity',
          'Verify SendGrid account status',
          'Check SendGrid account credits/quota',
        ]
      };
    }

    return {
      healthy: true,
      accountType: sendgridStatus.account.type,
      reputation: sendgridStatus.account.reputation,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      recommendations: [
        'Check network connectivity',
        'Verify SendGrid API endpoint accessibility',
      ]
    };
  }
}

// Example 6: Integration with API routes
export async function handleIncidentCreated(req, res) {
  try {
    const { incidentId, organizationId } = req.body;
    
    // Check email health first
    const emailHealth = await checkEmailServiceHealth();
    if (!emailHealth.healthy) {
      console.warn('Email service unhealthy, skipping notifications:', emailHealth.error);
      return res.status(200).json({ 
        success: true, 
        warning: 'Incident created but email notifications failed',
        emailError: emailHealth.error
      });
    }

    // Get incident and organization data
    const incident = await getIncidentById(incidentId);
    const organization = await getOrganizationById(organizationId);
    const teamMembers = await getOrganizationMembers(organizationId);

    // Send notifications
    const emailResults = await notifyIncidentToTeam({
      incidentId: incident.id,
      incidentTitle: incident.title,
      incidentDescription: incident.description,
      severity: incident.severity,
      status: incident.status,
      organizationId: organization.id,
      organizationName: organization.name,
      teamMembers,
      organizationBranding: organization.branding,
    });

    const successCount = emailResults.filter(r => r.success).length;
    const failureCount = emailResults.filter(r => !r.success).length;

    return res.status(200).json({
      success: true,
      incident,
      emailNotifications: {
        sent: successCount,
        failed: failureCount,
        results: emailResults,
      },
    });
  } catch (error) {
    console.error('Failed to handle incident creation:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create incident and send notifications' 
    });
  }
}

// Example 7: Custom email templates
export async function sendCustomNotification({
  toEmail,
  toName,
  subject,
  message,
  organizationName,
  ctaText = null,
  ctaUrl = null,
  organizationBranding = null
}) {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${organizationBranding?.logoUrl ? `<img src="${organizationBranding.logoUrl}" alt="${organizationName}" style="max-height: 40px; max-width: 200px; margin-bottom: 10px;">` : ''}
            <h1 style="margin: 0; font-size: 24px;">${subject}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${organizationName}</p>
        </div>
        
        <div class="content">
            <p>Hi ${toName || 'there'},</p>
            
            <div style="white-space: pre-wrap;">${message}</div>
            
            ${ctaText && ctaUrl ? `
            <div style="text-align: center; margin: 30px 0;">
                <a href="${ctaUrl}" class="button">${ctaText}</a>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>This notification was sent by ${organizationName} via Alert24.</p>
        </div>
    </div>
</body>
</html>
  `.trim();

  const textContent = `
${subject}

Hi ${toName || 'there'},

${message}

${ctaText && ctaUrl ? `${ctaText}: ${ctaUrl}` : ''}

This notification was sent by ${organizationName} via Alert24.
  `.trim();

  return emailService.sendEmail({
    to: toEmail,
    subject,
    htmlContent,
    textContent,
    organizationBranding,
  });
}

// Example helper functions (implement these based on your database schema)
async function getIncidentById(id) {
  // Implement based on your database
  throw new Error('Not implemented');
}

async function getOrganizationById(id) {
  // Implement based on your database
  throw new Error('Not implemented');
}

async function getOrganizationMembers(organizationId) {
  // Implement based on your database
  throw new Error('Not implemented');
}