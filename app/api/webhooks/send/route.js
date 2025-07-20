import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { createClient } from '@supabase/supabase-js';
import WebhookService from '../../../../lib/webhook-service';

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
      eventType,
      data,
      webhookIds,
      organizationId
    } = await request.json();

    if (!eventType || !data) {
      return NextResponse.json({ 
        error: 'Event type and data are required' 
      }, { status: 400 });
    }

    const targetOrgId = organizationId || session.user.organizationId;

    // Get webhooks to send to
    let query = supabase
      .from('webhooks')
      .select('*')
      .eq('organization_id', targetOrgId)
      .eq('is_active', true);

    if (webhookIds && webhookIds.length > 0) {
      query = query.in('id', webhookIds);
    }

    const { data: webhooks, error: fetchError } = await query;

    if (fetchError) {
      console.error('Database error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
    }

    if (!webhooks || webhooks.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No active webhooks found',
        stats: { total: 0, successful: 0, failed: 0, successRate: 0 }
      });
    }

    // Filter webhooks by event type
    const relevantWebhooks = webhooks.filter(webhook => {
      if (!webhook.events || webhook.events.length === 0) {
        return true; // Default to all events
      }
      return webhook.events.includes('*') || webhook.events.includes(eventType);
    });

    if (relevantWebhooks.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No webhooks configured for this event type',
        stats: { total: 0, successful: 0, failed: 0, successRate: 0 }
      });
    }

    // Parse JSON fields for each webhook
    const parsedWebhooks = relevantWebhooks.map(webhook => {
      const parsed = { ...webhook };
      
      ['auth_config', 'headers', 'payload_template', 'field_mapping'].forEach(field => {
        if (parsed[field]) {
          try {
            parsed[field] = JSON.parse(parsed[field]);
          } catch (error) {
            console.warn(`Invalid ${field} JSON for webhook ${webhook.id}:`, error);
            parsed[field] = null;
          }
        }
      });
      
      return parsed;
    });

    const webhookService = new WebhookService();
    
    // Create event payload
    const eventPayload = webhookService.createEventPayload(eventType, data);

    // Send webhooks
    const results = await webhookService.sendBatchWebhooks(
      parsedWebhooks,
      eventPayload,
      { event: eventType, batchSize: 10, batchDelay: 100 }
    );

    // Get delivery statistics
    const stats = await webhookService.getDeliveryStats(results);

    // Update webhook stats and log deliveries
    const deliveryLogs = [];
    const webhookUpdates = [];

    results.forEach((result, index) => {
      const webhook = parsedWebhooks[index];
      
      // Prepare delivery log
      deliveryLogs.push({
        webhook_id: webhook.id,
        organization_id: targetOrgId,
        event_type: eventType,
        payload: JSON.stringify(eventPayload),
        status: result.success ? 'success' : 'failed',
        response_status: result.status || null,
        response_time: result.responseTime || 0,
        error_message: result.error || null,
        attempt_count: result.attempt || 1,
        created_at: new Date().toISOString()
      });

      // Prepare webhook update
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (result.success) {
        updateData.last_success_at = new Date().toISOString();
        updateData.failure_count = 0;
      } else {
        updateData.last_failure_at = new Date().toISOString();
        updateData.failure_count = (webhook.failure_count || 0) + 1;
      }

      webhookUpdates.push({ id: webhook.id, updates: updateData });
    });

    // Log deliveries
    if (deliveryLogs.length > 0) {
      const { error: logError } = await supabase
        .from('webhook_deliveries')
        .insert(deliveryLogs);

      if (logError) {
        console.error('Failed to log webhook deliveries:', logError);
      }
    }

    // Update webhook stats
    for (const update of webhookUpdates) {
      await supabase
        .from('webhooks')
        .update(update.updates)
        .eq('id', update.id);
    }

    // Log to notification history
    const { error: historyError } = await supabase
      .from('notification_history')
      .insert({
        organization_id: targetOrgId,
        user_id: session.user.id,
        type: 'webhook',
        channel: 'webhook',
        recipient_count: relevantWebhooks.length,
        subject: `${eventType} webhook notification`,
        content: JSON.stringify(eventPayload),
        delivery_status: stats.successRate > 80 ? 'delivered' : 'partial_failure',
        metadata: {
          eventType,
          stats,
          webhookCount: relevantWebhooks.length
        },
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (historyError) {
      console.error('Failed to log notification history:', historyError);
    }

    return NextResponse.json({
      success: true,
      message: `Webhooks sent to ${relevantWebhooks.length} endpoints`,
      stats,
      results: process.env.NODE_ENV === 'development' ? results : undefined
    });

  } catch (error) {
    console.error('Send webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}