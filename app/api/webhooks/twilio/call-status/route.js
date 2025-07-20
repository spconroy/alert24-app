/**
 * Twilio Call Status Webhook
 * Receives call status updates from Twilio Voice API
 */

export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Parse form data from Twilio webhook
    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    console.log('Twilio call status webhook received:', {
      callSid: data.CallSid,
      accountSid: data.AccountSid,
      to: data.To,
      from: data.From,
      callStatus: data.CallStatus,
      direction: data.Direction,
      timestamp: new Date().toISOString()
    });

    // Log the full status update for debugging
    console.log('Full call status data:', data);

    // You can process the call status here
    // Common statuses: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
    
    switch (data.CallStatus) {
      case 'ringing':
        console.log(`Call ${data.CallSid} is ringing`);
        break;
      case 'in-progress':
        console.log(`Call ${data.CallSid} was answered`);
        break;
      case 'completed':
        console.log(`Call ${data.CallSid} completed successfully`, {
          duration: data.CallDuration,
          cost: data.DialCallPrice
        });
        break;
      case 'busy':
        console.log(`Call ${data.CallSid} encountered busy signal`);
        break;
      case 'failed':
        console.log(`Call ${data.CallSid} failed`);
        break;
      case 'no-answer':
        console.log(`Call ${data.CallSid} was not answered`);
        break;
      case 'canceled':
        console.log(`Call ${data.CallSid} was canceled`);
        break;
      default:
        console.log(`Call ${data.CallSid} status: ${data.CallStatus}`);
    }

    // Respond with 200 to acknowledge receipt
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Call status webhook error:', error);
    
    // Return 200 even on error to prevent Twilio retries for debugging webhooks
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Twilio call status webhook endpoint. Use POST method.' },
    { status: 200 }
  );
}