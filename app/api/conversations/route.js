import { NextResponse } from 'next/server';
import TwilioConversationsService from '@/lib/twilio-conversations';
import { Auth } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const session = await Auth.requireAuth(request);

    const body = await request.json();
    const { action, onCallPersonPhone, onCallPersonName } = body;

    const conversationsService = new TwilioConversationsService();
    const userIdentity = session.user.email;

    if (action === 'findOrCreate') {
      const result = await conversationsService.findOrCreateOnCallConversation(
        userIdentity,
        onCallPersonPhone,
        onCallPersonName
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // Generate access token for client
      const tokenResult = conversationsService.generateAccessToken(userIdentity);
      
      return NextResponse.json({
        conversationSid: result.conversationSid,
        accessToken: tokenResult.success ? tokenResult.token : null,
        identity: userIdentity,
        isNewConversation: result.isNewConversation
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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

    const url = new URL(request.url);
    const conversationSid = url.searchParams.get('conversationSid');
    const userIdentity = session.user.email;

    const conversationsService = new TwilioConversationsService();

    if (conversationSid) {
      // Get specific conversation details and messages
      const [conversationResult, messagesResult] = await Promise.all([
        conversationsService.getConversation(conversationSid),
        conversationsService.getMessages(conversationSid)
      ]);

      if (!conversationResult.success) {
        return NextResponse.json({ error: conversationResult.error }, { status: 400 });
      }

      return NextResponse.json({
        conversation: conversationResult.conversation,
        messages: messagesResult.success ? messagesResult.messages : []
      });
    } else {
      // Get user's conversations
      const result = await conversationsService.getUserConversations(userIdentity);
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        conversations: result.conversations
      });
    }
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}