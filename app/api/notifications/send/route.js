/**
 * Send Notifications API Route
 * Handles sending notifications through various channels (email, SMS, calls)
 */

export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import notificationService from '@/lib/notification-service';

const db = new SupabaseClient();

export async function POST(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = await request.json();
    const {
      type = 'manual', // 'manual', 'escalation', 'test'
      channels = ['email'],
      recipient,
      subject,
      message,
      incidentData,
      escalationRule,
      organizationId
    } = data;

    if (!recipient || !subject || !message) {
      return NextResponse.json(
        { error: 'Recipient, subject, and message are required' },
        { status: 400 }
      );
    }

    // Validate organizationId if provided
    if (organizationId) {
      const { data: membership } = await db.client
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    let result;

    switch (type) {
      case 'escalation':
        if (!escalationRule || !incidentData) {
          return NextResponse.json(
            { error: 'Escalation rule and incident data required for escalation notifications' },
            { status: 400 }
          );
        }
        
        result = await notificationService.sendEscalationNotifications(
          escalationRule,
          incidentData,
          organizationId
        );
        break;

      case 'test':
        if (channels.length !== 1) {
          return NextResponse.json(
            { error: 'Test notifications must specify exactly one channel' },
            { status: 400 }
          );
        }
        
        result = await notificationService.testNotification(
          channels[0],
          recipient,
          message
        );
        break;

      case 'manual':
      default:
        result = await notificationService.sendNotification({
          channels,
          recipient,
          subject,
          message,
          incidentData,
          priority: incidentData?.severity === 'critical' ? 'high' : 'normal',
          organizationId
        });
        break;
    }

    // Log the notification attempt with detailed debugging
    console.log('🔔 Notification Details:', {
      type,
      channels,
      recipient: {
        email: recipient.email,
        phone: recipient.phone,
        name: recipient.name
      },
      subject,
      message: message.substring(0, 100) + '...',
      result: {
        success: result.success,
        channels: result.channels,
        errors: result.errors
      },
      organizationId,
      timestamp: new Date().toISOString()
    });

    // Log environment check
    console.log('📧 Email Config:', {
      hasApiKey: !!process.env.SENDGRID_API_KEY,
      hasFromEmail: !!process.env.SENDGRID_FROM_EMAIL,
      apiKeyPrefix: process.env.SENDGRID_API_KEY?.substring(0, 8) + '...'
    });

    console.log('📱 SMS Config:', {
      hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
      hasMessagingService: !!process.env.TWILIO_MESSAGING_SERVICE_SID
    });

    return NextResponse.json({
      success: result.success,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in send notification API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return NextResponse.json(
    { message: 'Use POST method to send notifications' },
    { status: 405 }
  );
}