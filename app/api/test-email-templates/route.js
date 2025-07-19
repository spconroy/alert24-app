import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { emailService } from '@/lib/email-service';

export const runtime = 'edge';

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { template, testEmail } = await req.json();
    const targetEmail = testEmail || session.user.email;

    if (!emailService.isEnabled()) {
      return NextResponse.json({
        success: false,
        error: 'Email service not configured'
      });
    }

    let result;

    switch (template) {
      case 'invitation':
        result = await emailService.sendInvitationEmail({
          toEmail: targetEmail,
          toName: 'Test User',
          organizationName: 'Demo Organization',
          inviterName: 'Admin User',
          role: 'member',
          invitationLink: 'https://alert24.io/invitations/demo123',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
        break;

      case 'incident_critical':
        result = await emailService.sendIncidentNotification({
          toEmail: targetEmail,
          toName: 'Test User',
          organizationName: 'Demo Organization',
          incidentTitle: 'Database Connection Failure',
          incidentDescription: 'Our primary database cluster is experiencing connection timeouts. Users may experience slow loading times or errors when accessing the application.',
          severity: 'critical',
          status: 'investigating',
          incidentUrl: 'https://alert24.io/incidents/demo123',
        });
        break;

      case 'incident_resolved':
        result = await emailService.sendIncidentNotification({
          toEmail: targetEmail,
          toName: 'Test User',
          organizationName: 'Demo Organization',
          incidentTitle: 'Database Connection Failure',
          incidentDescription: 'The database connection issues have been resolved. All services are now operating normally.',
          severity: 'critical',
          status: 'resolved',
          incidentUrl: 'https://alert24.io/incidents/demo123',
        });
        break;

      case 'monitoring_down':
        result = await emailService.sendMonitoringAlert({
          toEmail: targetEmail,
          toName: 'Test User',
          organizationName: 'Demo Organization',
          serviceName: 'Web API',
          checkName: 'HTTP Health Check',
          alertType: 'down',
          errorMessage: 'Connection timeout after 30 seconds',
          responseTime: null,
          checkUrl: 'https://api.example.com/health',
        });
        break;

      case 'monitoring_up':
        result = await emailService.sendMonitoringAlert({
          toEmail: targetEmail,
          toName: 'Test User',
          organizationName: 'Demo Organization',
          serviceName: 'Web API',
          checkName: 'HTTP Health Check',
          alertType: 'up',
          errorMessage: null,
          responseTime: 245,
          checkUrl: 'https://api.example.com/health',
        });
        break;

      case 'monitoring_degraded':
        result = await emailService.sendMonitoringAlert({
          toEmail: targetEmail,
          toName: 'Test User',
          organizationName: 'Demo Organization',
          serviceName: 'Web API',
          checkName: 'HTTP Health Check',
          alertType: 'degraded',
          errorMessage: 'Response time exceeded threshold',
          responseTime: 8500,
          checkUrl: 'https://api.example.com/health',
        });
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid template type'
        }, { status: 400 });
    }

    return NextResponse.json({
      ...result,
      template,
      targetEmail,
    });

  } catch (error) {
    console.error('Email template test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to send template email',
      details: error.message,
    }, { status: 500 });
  }
}