/**
 * Send Notifications API Route
 * Handles sending notifications through various channels (email, SMS, calls)
 */

export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import notificationService from '@/lib/notification-service';

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      const { db } = await import('@/lib/db-supabase');
      
      const { data: membership } = await db.client
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', session.user.id)
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

    // Log the notification attempt
    console.log('Notification sent:', {
      type,
      channels,
      recipient: recipient.email || recipient.phone,
      success: result.success,
      timestamp: new Date().toISOString()
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