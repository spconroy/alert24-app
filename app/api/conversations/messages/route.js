export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import TwilioConversationsService from '@/lib/twilio-conversations';
import { Auth } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const session = await Auth.requireAuth(request);

    const body = await request.json();
    const { conversationSid, message, mediaUrls = [] } = body;

    if (!conversationSid || !message) {
      return NextResponse.json(
        { error: 'conversationSid and message are required' },
        { status: 400 }
      );
    }

    const conversationsService = new TwilioConversationsService();
    const userIdentity = session.user.email;

    const result = await conversationsService.sendMessage(
      conversationSid,
      message,
      userIdentity,
      mediaUrls
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      messageSid: result.messageSid,
      body: result.body,
      author: result.author,
      dateCreated: result.dateCreated,
      index: result.index
    });
  } catch (error) {
    console.error('Send message API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const session = await Auth.requireAuth(request);

    const url = new URL(request.url);
    const conversationSid = url.searchParams.get('conversationSid');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!conversationSid) {
      return NextResponse.json(
        { error: 'conversationSid is required' },
        { status: 400 }
      );
    }

    const conversationsService = new TwilioConversationsService();
    const result = await conversationsService.getMessages(conversationSid, limit);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      messages: result.messages
    });
  } catch (error) {
    console.error('Get messages API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}