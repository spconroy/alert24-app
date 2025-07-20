import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { createClient } from '@supabase/supabase-js';
import WebhookService from '../../../lib/webhook-service';

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
      name,
      url,
      description,
      events,
      auth_type,
      auth_config,
      headers,
      payload_template,
      field_mapping,
      secret,
      is_active = true
    } = await request.json();

    if (!name || !url) {
      return NextResponse.json({ 
        error: 'Name and URL are required' 
      }, { status: 400 });
    }

    // Validate webhook configuration
    const webhookService = new WebhookService();
    const webhook = { url, auth_type, auth_config, headers, payload_template, field_mapping };
    const validation = webhookService.validateWebhook(webhook);

    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Invalid webhook configuration',
        details: validation.errors
      }, { status: 400 });
    }

    // Create webhook in database
    const { data: newWebhook, error: createError } = await supabase
      .from('webhooks')
      .insert({
        organization_id: session.user.organizationId,
        created_by: session.user.id,
        name,
        url,
        description,
        events: events || ['*'], // Default to all events
        auth_type,
        auth_config: auth_config ? JSON.stringify(auth_config) : null,
        headers: headers ? JSON.stringify(headers) : null,
        payload_template: payload_template ? JSON.stringify(payload_template) : null,
        field_mapping: field_mapping ? JSON.stringify(field_mapping) : null,
        secret,
        is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Database error:', createError);
      return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      webhook: {
        ...newWebhook,
        auth_config: undefined, // Don't return sensitive data
        secret: undefined
      },
      message: 'Webhook created successfully'
    });

  } catch (error) {
    console.error('Create webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let query = supabase
      .from('webhooks')
      .select(`
        id,
        name,
        url,
        description,
        events,
        auth_type,
        is_active,
        last_success_at,
        last_failure_at,
        failure_count,
        created_at,
        updated_at,
        created_by_user:users(name, email)
      `)
      .eq('organization_id', session.user.organizationId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: webhooks, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
    }

    return NextResponse.json({ 
      webhooks: webhooks || [],
      total: webhooks?.length || 0
    });

  } catch (error) {
    console.error('Get webhooks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
    }

    const updateData = await request.json();

    // Validate webhook configuration if URL or auth settings changed
    if (updateData.url || updateData.auth_type || updateData.auth_config || 
        updateData.headers || updateData.payload_template || updateData.field_mapping) {
      
      const webhookService = new WebhookService();
      const webhook = {
        url: updateData.url,
        auth_type: updateData.auth_type,
        auth_config: updateData.auth_config,
        headers: updateData.headers,
        payload_template: updateData.payload_template,
        field_mapping: updateData.field_mapping
      };
      
      const validation = webhookService.validateWebhook(webhook);
      if (!validation.isValid) {
        return NextResponse.json({
          error: 'Invalid webhook configuration',
          details: validation.errors
        }, { status: 400 });
      }
    }

    // Prepare update data
    const dbUpdateData = {
      updated_at: new Date().toISOString()
    };

    // Only include fields that are provided
    const allowedFields = [
      'name', 'url', 'description', 'events', 'auth_type', 
      'auth_config', 'headers', 'payload_template', 'field_mapping', 
      'secret', 'is_active'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (['auth_config', 'headers', 'payload_template', 'field_mapping'].includes(field)) {
          dbUpdateData[field] = updateData[field] ? JSON.stringify(updateData[field]) : null;
        } else {
          dbUpdateData[field] = updateData[field];
        }
      }
    });

    const { data: updatedWebhook, error: updateError } = await supabase
      .from('webhooks')
      .update(dbUpdateData)
      .eq('id', webhookId)
      .eq('organization_id', session.user.organizationId)
      .select()
      .single();

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      webhook: {
        ...updatedWebhook,
        auth_config: undefined, // Don't return sensitive data
        secret: undefined
      },
      message: 'Webhook updated successfully'
    });

  } catch (error) {
    console.error('Update webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', webhookId)
      .eq('organization_id', session.user.organizationId);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully'
    });

  } catch (error) {
    console.error('Delete webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}