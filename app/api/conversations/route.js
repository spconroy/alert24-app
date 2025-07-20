export const runtime = 'edge';

import { NextResponse } from 'next/server';
// import TwilioConversationsService from '@/lib/twilio-conversations';
import { Auth } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const session = await Auth.requireAuth(request);

    // Temporarily disabled for Cloudflare Edge Runtime compatibility
    return NextResponse.json(
      { error: 'Twilio Conversations feature temporarily unavailable during Edge Runtime migration' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const session = await Auth.requireAuth(request);

    // Temporarily disabled for Cloudflare Edge Runtime compatibility
    return NextResponse.json(
      { error: 'Twilio Conversations feature temporarily unavailable during Edge Runtime migration' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}