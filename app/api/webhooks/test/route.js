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

    const { webhookId, testPayload } = await request.json();

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 });
    }

    // Get webhook from database
    const { data: webhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .eq('organization_id', session.user.organizationId)
      .single();

    if (fetchError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Parse JSON fields
    if (webhook.auth_config) {
      try {
        webhook.auth_config = JSON.parse(webhook.auth_config);
      } catch (error) {
        console.warn('Invalid auth_config JSON:', error);
        webhook.auth_config = null;
      }
    }

    if (webhook.headers) {
      try {
        webhook.headers = JSON.parse(webhook.headers);
      } catch (error) {
        console.warn('Invalid headers JSON:', error);
        webhook.headers = null;
      }
    }

    if (webhook.payload_template) {
      try {
        webhook.payload_template = JSON.parse(webhook.payload_template);
      } catch (error) {
        console.warn('Invalid payload_template JSON:', error);
        webhook.payload_template = null;
      }
    }

    if (webhook.field_mapping) {
      try {
        webhook.field_mapping = JSON.parse(webhook.field_mapping);
      } catch (error) {
        console.warn('Invalid field_mapping JSON:', error);
        webhook.field_mapping = null;
      }
    }

    const webhookService = new WebhookService();
    
    // Use custom test payload or default
    const payload = testPayload || {
      test: true,
      message: 'This is a test webhook from Alert24',
      organization: {
        id: session.user.organizationId,
        name: session.user.organizationName || 'Test Organization'
      },
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email
      },
      timestamp: new Date().toISOString()
    };

    // Send test webhook
    const result = await webhookService.testWebhook(webhook, payload);

    // Update webhook stats
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

    await supabase
      .from('webhooks')
      .update(updateData)
      .eq('id', webhookId);

    // Log test delivery
    const { error: logError } = await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhookId,
        organization_id: session.user.organizationId,
        event_type: 'test',
        payload: JSON.stringify(payload),
        status: result.success ? 'success' : 'failed',
        response_status: result.status,
        response_time: result.responseTime || 0,
        error_message: result.error || null,
        attempt_count: 1,
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Failed to log webhook delivery:', logError);
    }

    return NextResponse.json({
      success: result.success,
      result,
      message: result.success ? 'Test webhook sent successfully' : 'Test webhook failed'
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}