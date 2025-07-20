/**
 * Test Call API Route
 * Makes test phone calls using Twilio Voice API
 */

export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { testPhone } = await request.json();

    if (!testPhone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate Twilio configuration
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return NextResponse.json(
        { 
          error: 'Twilio configuration incomplete',
          details: {
            hasAccountSid: !!accountSid,
            hasAuthToken: !!authToken,
            hasPhoneNumber: !!twilioPhoneNumber
          }
        },
        { status: 500 }
      );
    }

    // Format phone number
    const formatPhoneNumber = (phoneNumber) => {
      // Remove all non-digit characters except +
      const cleaned = phoneNumber.replace(/[^\d+]/g, '');
      
      // Check if it starts with + and has country code
      if (cleaned.startsWith('+') && cleaned.length >= 10 && cleaned.length <= 15) {
        return cleaned;
      }
      
      // Try to add default country code if missing
      if (!cleaned.startsWith('+') && cleaned.length === 10) {
        // Assume US/Canada if 10 digits
        return `+1${cleaned}`;
      }
      
      throw new Error('Invalid phone number format. Please include country code (e.g., +1234567890)');
    };

    const formattedPhone = formatPhoneNumber(testPhone);

    // Create TwiML for the call
    const twimlMessage = `
      <Response>
        <Say voice="alice" language="en-US">
          Hello! This is a test call from Alert 24 debug system. 
          If you can hear this message, your phone call integration is working correctly.
          This call will automatically end in a few seconds. 
          Thank you for testing!
        </Say>
        <Pause length="2"/>
        <Say voice="alice" language="en-US">
          Test call complete. Goodbye!
        </Say>
      </Response>
    `.trim();

    // Make Twilio API call
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    
    const payload = new URLSearchParams({
      To: formattedPhone,
      From: twilioPhoneNumber,
      Twiml: twimlMessage,
      MaxPrice: '0.50', // USD price limit per call
      StatusCallback: `${process.env.NEXTAUTH_URL || 'https://alert24.app'}/api/webhooks/twilio/call-status`
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio API error:', data);
      return NextResponse.json(
        { 
          error: data.message || 'Failed to make call',
          code: data.code,
          moreInfo: data.more_info,
          status: data.status,
          details: data
        },
        { status: response.status }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Test call initiated successfully',
      callId: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
      direction: data.direction,
      dateCreated: data.date_created,
      cost: data.price,
      currency: data.price_unit,
      duration: data.duration,
      timestamp: new Date().toISOString(),
      provider: 'twilio',
      twiml: twimlMessage.replace(/\s+/g, ' ') // Clean up for response
    });

  } catch (error) {
    console.error('Test call error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: error.stack,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Use POST method to make test calls' },
    { status: 405 }
  );
}