import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

// Simple SMS service check without importing the full module
function checkSMSConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  return {
    hasAccountSid: !!accountSid,
    hasAuthToken: !!authToken,
    hasPhoneNumber: !!phoneNumber,
    hasMessagingServiceSid: !!messagingServiceSid,
    fromIdentifier: phoneNumber || messagingServiceSid,
    configStatus: !accountSid
      ? 'missing_account_sid'
      : !authToken
        ? 'missing_auth_token'
        : (!phoneNumber && !messagingServiceSid)
          ? 'missing_from_identifier'
          : 'configured',
  };
}

function formatPhoneNumber(phoneNumber) {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Add + if not present and starts with a digit
  if (!cleaned.startsWith('+') && cleaned.length > 0) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

async function sendTestSMS(to, from, accountSid, authToken) {
  try {
    const formattedTo = formatPhoneNumber(to);
    
    // Validate phone number format
    if (!formattedTo.match(/^\+\d{10,15}$/)) {
      throw new Error('Invalid phone number format. Use format: +1234567890');
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    
    const payload = new URLSearchParams({
      To: formattedTo,
      Body: 'Alert24 SMS Service Test: Your notification system is working correctly! 🚀',
      MaxPrice: '0.50' // USD price limit per message
    });

    // Use phone number or messaging service SID as the from identifier
    if (from.startsWith('+')) {
      payload.append('From', from);
    } else {
      payload.append('MessagingServiceSid', from);
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload,
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status} - ${responseData.message || JSON.stringify(responseData)}`);
    }

    return { 
      success: true, 
      message: 'Test SMS sent successfully',
      messageId: responseData.sid,
      status: responseData.status,
      to: formattedTo
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    const { action, testPhone } = await req.json();

    if (action === 'check-config') {
      const config = checkSMSConfig();
      
      return NextResponse.json({
        success: true,
        config,
        message:
          config.configStatus === 'configured'
            ? 'SMS service is properly configured'
            : 'SMS service configuration incomplete',
      });
    }

    if (action === 'test') {
      if (!session || !session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!testPhone) {
        return NextResponse.json({
          success: false,
          error: 'Phone number is required for SMS test',
        }, { status: 400 });
      }

      const config = checkSMSConfig();

      if (!config.hasAccountSid) {
        return NextResponse.json({
          success: false,
          error: 'TWILIO_ACCOUNT_SID not configured. Please add it to your environment variables.',
          config,
        });
      }

      if (!config.hasAuthToken) {
        return NextResponse.json({
          success: false,
          error: 'TWILIO_AUTH_TOKEN not configured. Please add it to your environment variables.',
          config,
        });
      }

      if (!config.fromIdentifier) {
        return NextResponse.json({
          success: false,
          error: 'Either TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID must be configured.',
          config,
        });
      }

      const result = await sendTestSMS(
        testPhone,
        config.fromIdentifier,
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      return NextResponse.json({
        ...result,
        config,
        targetPhone: testPhone,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "check-config" or "test".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('SMS test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test SMS service',
        details: error.message,
      },
      { status: 500 }
    );
  }
}