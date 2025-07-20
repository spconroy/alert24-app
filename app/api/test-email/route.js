import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { emailService } from '@/lib/email-service';

export const runtime = 'edge';

// Simple email service check without importing the full module
function checkEmailConfig() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  return {
    hasApiKey: !!apiKey,
    apiKeyValid: apiKey && apiKey.startsWith('SG.') && apiKey.length > 20,
    hasFromEmail: !!fromEmail,
    fromEmail: fromEmail || 'noreply@alert24.net',
    configStatus: !apiKey
      ? 'missing_api_key'
      : !fromEmail
        ? 'missing_from_email'
        : 'configured',
  };
}

async function sendTestEmail(toEmail, fromEmail, apiKey) {
  try {
    // Use fetch to call SendGrid API directly since sgMail might not work in Edge Runtime
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: toEmail }],
            subject: 'Alert24 Email Service Test',
          },
        ],
        from: {
          email: fromEmail,
          name: 'Alert24 System',
        },
        content: [
          {
            type: 'text/html',
            value: `
            <h2>Email Service Test</h2>
            <p>This is a test email from Alert24 to verify that email notifications are working correctly.</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Sent to: ${toEmail}</li>
              <li>From: ${fromEmail}</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
            </ul>
            <p>If you received this email, your Alert24 email service is configured correctly!</p>
          `,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorData}`);
    }

    return { success: true, message: 'Test email sent successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    const { action, testEmail } = await req.json();

    if (action === 'check-config') {
      const config = checkEmailConfig();
      
      // Also check SendGrid account status if configured
      let sendgridStatus = null;
      if (config.configStatus === 'configured') {
        sendgridStatus = await emailService.checkSendGridStatus();
      }
      
      return NextResponse.json({
        success: true,
        config,
        sendgridStatus,
        message:
          config.configStatus === 'configured'
            ? sendgridStatus?.valid 
              ? 'Email service is properly configured and SendGrid account is accessible'
              : `Email service configured but SendGrid error: ${sendgridStatus?.error}`
            : 'Email service configuration incomplete',
      });
    }

    if (action === 'test') {
      if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const config = checkEmailConfig();

      if (!config.hasApiKey) {
        return NextResponse.json({
          success: false,
          error:
            'SENDGRID_API_KEY not configured. Please add it to your environment variables.',
          config,
        });
      }

      if (!config.apiKeyValid) {
        return NextResponse.json({
          success: false,
          error:
            'SENDGRID_API_KEY appears to be invalid. It should start with "SG." and be longer than 20 characters.',
          config,
        });
      }

      const targetEmail = testEmail || session.user.email;
      
      // Use the enhanced email service instead of the simple function
      const result = await emailService.sendEmail({
        to: targetEmail,
        subject: 'Alert24 Email Service Test',
        htmlContent: `
          <h2>🎉 Email Service Test</h2>
          <p>This is a test email from Alert24 to verify that email notifications are working correctly.</p>
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>Sent to: ${targetEmail}</li>
            <li>From: ${config.fromEmail}</li>
            <li>Timestamp: ${new Date().toISOString()}</li>
          </ul>
          <p>If you received this email, your Alert24 email service is configured correctly!</p>
        `,
        textContent: `
Email Service Test

This is a test email from Alert24 to verify that email notifications are working correctly.

Test Details:
- Sent to: ${targetEmail}
- From: ${config.fromEmail}
- Timestamp: ${new Date().toISOString()}

If you received this email, your Alert24 email service is configured correctly!
        `.trim(),
      });

      return NextResponse.json({
        ...result,
        config,
        targetEmail,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "check-config" or "test".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test email service',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
