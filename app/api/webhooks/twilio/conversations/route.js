export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    // Extract webhook data
    const webhookData = {
      EventType: params.get('EventType'),
      ConversationSid: params.get('ConversationSid'),
      MessageSid: params.get('MessageSid'),
      Body: params.get('Body'),
      Author: params.get('Author'),
      ParticipantSid: params.get('ParticipantSid'),
      DateCreated: params.get('DateCreated'),
      Index: params.get('Index'),
      Source: params.get('Source'),
      Media: params.get('Media'),
    };

    console.log('📨 Twilio Conversation Webhook:', webhookData);

    // Handle different event types
    switch (webhookData.EventType) {
      case 'onMessageAdded':
        console.log(`New message in conversation ${webhookData.ConversationSid}: ${webhookData.Body}`);
        
        // Here you could:
        // 1. Store the message in your database
        // 2. Send real-time updates to connected clients via WebSocket/SSE
        // 3. Send push notifications
        // 4. Trigger automated responses
        
        break;
        
      case 'onConversationAdded':
        console.log(`New conversation created: ${webhookData.ConversationSid}`);
        break;
        
      case 'onParticipantAdded':
        console.log(`Participant added to conversation ${webhookData.ConversationSid}`);
        break;
        
      case 'onConversationStateUpdated':
        console.log(`Conversation state updated: ${webhookData.ConversationSid}`);
        break;
        
      default:
        console.log(`Unhandled event type: ${webhookData.EventType}`);
    }

    // Respond with 200 to acknowledge receipt
    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error('Twilio conversation webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle webhook verification if needed
export async function GET(request) {
  return NextResponse.json({ 
    message: 'Twilio Conversations Webhook Endpoint',
    status: 'active' 
  });
}