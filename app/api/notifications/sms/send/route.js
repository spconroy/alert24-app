import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { createClient } from '@supabase/supabase-js';
import SMSService from '../../../../../lib/sms-service';

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
      message,
      targetUsers, 
      targetOrganization,
      messageType = 'custom',
      templateData = {},
      priority = 'normal',
      scheduledAt,
      maxPrice
    } = await request.json();

    if (!message && !messageType) {
      return NextResponse.json({ error: 'Message or message type is required' }, { status: 400 });
    }

    // Determine target users
    let query = supabase
      .from('user_contact_methods')
      .select(`
        *,
        users!inner(id, name, email, organization_id)
      `)
      .eq('contact_type', 'sms')
      .eq('is_verified', true)
      .eq('is_active', true);

    if (targetUsers && targetUsers.length > 0) {
      query = query.in('user_id', targetUsers);
    } else if (targetOrganization) {
      query = query.eq('users.organization_id', targetOrganization);
    } else {
      // Default to current user's organization
      query = query.eq('users.organization_id', session.user.organizationId);
    }

    const { data: contacts, error: fetchError } = await query;

    if (fetchError) {
      console.error('Database error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch SMS contacts' }, { status: 500 });
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No verified SMS contacts found',
        stats: { total: 0, successful: 0, failed: 0, successRate: 0, totalCost: 0 }
      });
    }

    const smsService = new SMSService();
    let results = [];

    if (messageType !== 'custom') {
      // Use templated message
      results = await Promise.all(
        contacts.map(contact => 
          smsService.sendTemplatedSMS(
            contact.contact_value,
            messageType,
            templateData,
            { priority, maxPrice }
          )
        )
      );
    } else {
      // Use custom message
      const recipients = contacts.map(contact => contact.contact_value);
      results = await smsService.sendBatchSMS(recipients, message, {
        priority,
        maxPrice,
        batchSize: 50,
        batchDelay: 1000
      });
    }

    // Get delivery statistics
    const stats = await smsService.getDeliveryStats(results);

    // Log notification history
    const notificationHistory = {
      organization_id: session.user.organizationId,
      user_id: session.user.id,
      type: 'sms',
      channel: 'sms',
      recipient_count: contacts.length,
      subject: messageType !== 'custom' ? `${messageType} notification` : 'SMS notification',
      content: messageType !== 'custom' ? JSON.stringify(templateData) : message,
      delivery_status: stats.successRate > 80 ? 'delivered' : 'partial_failure',
      metadata: {
        messageType,
        templateData,
        stats,
        targetUsers,
        targetOrganization,
        priority
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

    // Log individual delivery results
    const deliveryLogs = results.map((result, index) => ({
      notification_history_id: null, // Will be updated if history insert succeeds
      channel: 'sms',
      recipient_identifier: contacts[index]?.contact_value || 'unknown',
      delivery_status: result.success ? 'sent' : 'failed',
      delivery_attempts: 1,
      provider_response: {
        messageId: result.messageId,
        status: result.status,
        cost: result.cost,
        currency: result.currency,
        provider: result.provider
      },
      error_message: result.error,
      delivered_at: result.success ? new Date().toISOString() : null,
      created_at: new Date().toISOString()
    }));

    const { error: logsError } = await supabase
      .from('notification_delivery_log')
      .insert(deliveryLogs);

    if (logsError) {
      console.error('Failed to log delivery results:', logsError);
    }

    return NextResponse.json({
      success: true,
      message: `SMS notifications sent to ${contacts.length} recipients`,
      stats,
      results: process.env.NODE_ENV === 'development' ? results : undefined
    });

  } catch (error) {
    console.error('Send SMS error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Test endpoint for development
export async function GET(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Test endpoint only available in development' }, { status: 403 });
    }

    // Get current user's verified SMS contacts
    const { data: contacts, error } = await supabase
      .from('user_contact_methods')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('contact_type', 'sms')
      .eq('is_verified', true)
      .eq('is_active', true);

    if (error || !contacts || contacts.length === 0) {
      return NextResponse.json({ 
        error: 'No verified SMS contacts found for testing',
        message: 'Please add and verify a phone number first'
      }, { status: 404 });
    }

    const smsService = new SMSService();
    const testMessage = 'Alert24 test SMS: Your notification system is working correctly! 🚀';

    const results = await smsService.sendBatchSMS(
      contacts.map(c => c.contact_value),
      testMessage,
      { priority: 'normal' }
    );

    const stats = await smsService.getDeliveryStats(results);

    return NextResponse.json({
      success: true,
      message: 'Test SMS sent',
      stats,
      results
    });

  } catch (error) {
    console.error('Test SMS error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}