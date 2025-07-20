import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { createClient } from '@supabase/supabase-js';
import PushNotificationService from '../../../../lib/push-notification-service';

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

    const { subscription, deviceInfo } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    const pushService = new PushNotificationService();
    if (!pushService.validateSubscription(subscription)) {
      return NextResponse.json({ error: 'Invalid push subscription format' }, { status: 400 });
    }

    // Store subscription in database
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: session.user.id,
        organization_id: session.user.organizationId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        device_type: deviceInfo?.type || 'unknown',
        device_name: deviceInfo?.name || 'Unknown Device',
        browser: deviceInfo?.browser || 'Unknown Browser',
        is_active: true,
        last_used: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'endpoint',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to store subscription' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      subscriptionId: data[0]?.id,
      message: 'Push subscription registered successfully'
    });

  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let query = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', session.user.id);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    // Remove sensitive keys from response
    const sanitizedData = data.map(sub => ({
      id: sub.id,
      device_type: sub.device_type,
      device_name: sub.device_name,
      browser: sub.browser,
      is_active: sub.is_active,
      last_used: sub.last_used,
      created_at: sub.created_at
    }));

    return NextResponse.json({ subscriptions: sanitizedData });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('id');
    const endpoint = searchParams.get('endpoint');

    if (!subscriptionId && !endpoint) {
      return NextResponse.json({ error: 'Subscription ID or endpoint required' }, { status: 400 });
    }

    let query = supabase
      .from('push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id);

    if (subscriptionId) {
      query = query.eq('id', subscriptionId);
    } else {
      query = query.eq('endpoint', endpoint);
    }

    const { error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Push subscription removed successfully'
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}