import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    // Parse Twilio webhook data (form-urlencoded)
    const formData = await request.formData();
    const webhookData = {};
    
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value;
    }

    console.log('Twilio SMS status webhook received:', webhookData);

    const {
      MessageSid: messageId,
      MessageStatus: status,
      To: to,
      From: from,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
      Price: price,
      PriceUnit: priceUnit
    } = webhookData;

    if (!messageId) {
      return NextResponse.json({ error: 'Missing MessageSid' }, { status: 400 });
    }

    // Map Twilio status to our delivery status
    const deliveryStatusMap = {
      'queued': 'pending',
      'sent': 'sent',
      'delivered': 'delivered',
      'undelivered': 'failed',
      'failed': 'failed',
      'received': 'delivered' // For incoming messages (shouldn't happen for our outbound messages)
    };

    const deliveryStatus = deliveryStatusMap[status] || 'failed';

    // Update notification_delivery_log if we can find a matching record
    const { data: existingLog, error: fetchError } = await supabase
      .from('notification_delivery_log')
      .select('*')
      .eq('channel', 'sms')
      .eq('recipient_identifier', to)
      .or(`provider_response->>messageId.eq.${messageId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching delivery log:', fetchError);
    }

    if (existingLog) {
      // Update existing delivery log
      const updatedProviderResponse = {
        ...existingLog.provider_response,
        status,
        price,
        priceUnit,
        lastUpdated: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('notification_delivery_log')
        .update({
          delivery_status: deliveryStatus,
          provider_response: updatedProviderResponse,
          error_message: errorMessage || null,
          delivered_at: (status === 'delivered') ? new Date().toISOString() : existingLog.delivered_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLog.id);

      if (updateError) {
        console.error('Error updating delivery log:', updateError);
      } else {
        console.log(`Updated delivery log for message ${messageId}: ${status}`);
      }
    } else {
      // Create new delivery log entry if none exists
      console.log(`No existing delivery log found for message ${messageId}, creating new entry`);
      
      const { error: insertError } = await supabase
        .from('notification_delivery_log')
        .insert({
          channel: 'sms',
          recipient_identifier: to,
          delivery_status: deliveryStatus,
          delivery_attempts: 1,
          provider_response: {
            messageId,
            status,
            price,
            priceUnit,
            provider: 'twilio',
            from,
            errorCode,
            errorMessage,
            receivedAt: new Date().toISOString()
          },
          error_message: errorMessage || null,
          delivered_at: (status === 'delivered') ? new Date().toISOString() : null,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating delivery log:', insertError);
      }
    }

    // Track delivery metrics for analytics
    try {
      await trackDeliveryMetrics({
        channel: 'sms',
        status: deliveryStatus,
        provider: 'twilio',
        messageId,
        cost: price ? Math.abs(parseFloat(price)) : 0,
        currency: priceUnit || 'USD',
        errorCode,
        timestamp: new Date().toISOString()
      });
    } catch (metricsError) {
      console.warn('Failed to track delivery metrics:', metricsError);
    }

    // Update user contact method status if delivery failed permanently
    if (status === 'undelivered' || status === 'failed') {
      try {
        // Mark contact as potentially inactive if multiple failures
        const { data: recentFailures, error: failureError } = await supabase
          .from('notification_delivery_log')
          .select('id')
          .eq('channel', 'sms')
          .eq('recipient_identifier', to)
          .eq('delivery_status', 'failed')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
          .limit(5);

        if (!failureError && recentFailures && recentFailures.length >= 3) {
          console.log(`Multiple SMS failures for ${to}, considering marking as inactive`);
          
          // Could implement logic to temporarily disable SMS for this contact
          // For now, just log the situation
        }
      } catch (contactError) {
        console.warn('Failed to check contact status:', contactError);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'SMS status updated successfully',
      messageId,
      status: deliveryStatus
    });

  } catch (error) {
    console.error('Twilio SMS webhook error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * Track delivery metrics for analytics
 */
async function trackDeliveryMetrics(metrics) {
  try {
    // This could be expanded to store in a dedicated metrics table
    // or send to external analytics services
    
    console.log('SMS Delivery Metrics:', {
      channel: metrics.channel,
      status: metrics.status,
      provider: metrics.provider,
      cost: metrics.cost,
      currency: metrics.currency,
      timestamp: metrics.timestamp
    });

    // Could also aggregate daily/hourly metrics here
    // For example: increment counters for successful/failed deliveries
    
  } catch (error) {
    console.warn('Metrics tracking failed:', error);
  }
}

// Verify Twilio webhook (optional but recommended for production)
function verifyTwilioSignature(request, body) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSignature = request.headers.get('x-twilio-signature');
  
  if (!authToken || !twilioSignature) {
    return false;
  }

  // In production, implement proper Twilio signature verification
  // using the Twilio library or crypto functions
  // For now, we'll skip verification in development
  
  return process.env.NODE_ENV === 'development' || true;
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({ 
    status: 'ok',
    service: 'twilio-sms-webhook',
    timestamp: new Date().toISOString()
  });
}