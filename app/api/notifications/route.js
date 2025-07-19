import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/db-supabase';

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const emailType = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check if user belongs to organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build query
    let query = supabase
      .from('email_notifications')
      .select(`
        id,
        to_email,
        subject,
        email_type,
        priority,
        status,
        attempts,
        message_id,
        error,
        created_at,
        sent_at,
        last_attempt_at
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (emailType) {
      query = query.eq('email_type', emailType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('email_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (emailType) {
      countQuery = countQuery.eq('email_type', emailType);
    }

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      notifications,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });
  } catch (error) {
    console.error('Error in notifications API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { organizationId, notifications } = data;

    if (!organizationId || !notifications || !Array.isArray(notifications)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Check if user belongs to organization and has permission to send notifications
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .single();

    if (!membership || !['admin', 'member'].includes(membership.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Process notifications through email service
    const { emailService } = await import('@/lib/email-service');
    
    const result = await emailService.sendBulkNotifications(
      notifications.map(notification => ({
        ...notification,
        organizationId,
      }))
    );

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      totalQueued: result.totalQueued,
      queueIds: result.queueIds,
    });
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}