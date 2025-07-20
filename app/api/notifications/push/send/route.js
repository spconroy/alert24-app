import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { createClient } from '@supabase/supabase-js';
import PushNotificationService from '../../../../../lib/push-notification-service';

export const runtime = 'edge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      title, 
      body, 
      targetUsers, 
      targetOrganization, 
      icon, 
      badge,
      image,
      url,
      actions,
      tag,
      requireInteraction,
      priority = 'normal',
      data = {}
    } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // Determine target users
    let query = supabase
      .from('push_subscriptions')
      .select(`
        *,
        users!inner(id, email, organization_id)
      `)
      .eq('is_active', true);

    if (targetUsers && targetUsers.length > 0) {
      query = query.in('user_id', targetUsers);
    } else if (targetOrganization) {
      query = query.eq('users.organization_id', targetOrganization);
    } else {
      // Default to current user's organization
      query = query.eq('users.organization_id', session.user.organizationId);
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error('Database error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No active push subscriptions found',
        stats: { total: 0, successful: 0, failed: 0, successRate: 0 }
      });
    }

    // Create notification payload
    const pushService = new PushNotificationService();
    const notification = {
      title,
      body,
      icon,
      badge,
      image,
      url,
      actions,
      tag,
      requireInteraction,
      data: {
        ...data,
        priority,
        organizationId: session.user.organizationId,
        sentBy: session.user.id,
        sentAt: new Date().toISOString()
      }
    };

    const payload = pushService.createPayload(notification);

    // Convert subscriptions to Web Push format
    const webPushSubscriptions = subscriptions.map(sub => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh_key,
        auth: sub.auth_key
      }
    }));

    // Send notifications
    const results = await pushService.sendBatchNotifications(
      webPushSubscriptions,
      payload,
      { batchSize: 100, batchDelay: 100 }
    );

    // Get delivery statistics
    const stats = await pushService.getDeliveryStats(results);

    // Log notification history
    const notificationHistory = {
      organization_id: session.user.organizationId,
      user_id: session.user.id,
      type: 'push',
      channel: 'push_notification',
      recipient_count: subscriptions.length,
      subject: title,
      content: body,
      delivery_status: stats.successRate > 80 ? 'delivered' : 'partial_failure',
      metadata: {
        notification,
        stats,
        targetUsers,
        targetOrganization
      },
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { error: historyError } = await supabase
      .from('notification_history')
      .insert(notificationHistory);

    if (historyError) {
      console.error('Failed to log notification history:', historyError);
    }

    // Update last_used for successful subscriptions
    const successfulEndpoints = results
      .filter(result => result.success)
      .map(result => result.endpoint);

    if (successfulEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ last_used: new Date().toISOString() })
        .in('endpoint', successfulEndpoints);
    }

    // Deactivate failed subscriptions (410 Gone responses)
    const failedEndpoints = results
      .filter(result => !result.success && result.status === 410)
      .map(result => result.endpoint);

    if (failedEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('endpoint', failedEndpoints);
    }

    return NextResponse.json({
      success: true,
      message: `Push notifications sent to ${subscriptions.length} devices`,
      stats,
      results: process.env.NODE_ENV === 'development' ? results : undefined
    });

  } catch (error) {
    console.error('Send push notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Test endpoint for development
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Test endpoint only available in development' }, { status: 403 });
    }

    // Send test notification to current user
    const testNotification = {
      title: 'Alert24 Test Notification',
      body: 'This is a test push notification from Alert24',
      icon: '/icons/notification-icon.png',
      badge: '/icons/notification-badge.png',
      url: '/',
      tag: 'test-notification',
      data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    // Get current user's subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true);

    if (error || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        error: 'No active push subscriptions found for testing',
        message: 'Please subscribe to push notifications first'
      }, { status: 404 });
    }

    const pushService = new PushNotificationService();
    const payload = pushService.createPayload(testNotification);

    const webPushSubscriptions = subscriptions.map(sub => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh_key,
        auth: sub.auth_key
      }
    }));

    const results = await pushService.sendBatchNotifications(webPushSubscriptions, payload);
    const stats = await pushService.getDeliveryStats(results);

    return NextResponse.json({
      success: true,
      message: 'Test notification sent',
      stats,
      results
    });

  } catch (error) {
    console.error('Test notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}