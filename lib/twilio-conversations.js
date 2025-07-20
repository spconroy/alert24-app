/**
 * Twilio Conversations Service
 * Handles conversation creation, messaging, and participant management
 */

import twilio from 'twilio';

class TwilioConversationsService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!this.accountSid || !this.authToken) {
      throw new Error('Twilio credentials not configured');
    }
    
    this.client = twilio(this.accountSid, this.authToken);
  }

  /**
   * Create a new conversation for texting with on-call person
   */
  async createConversation(friendlyName, uniqueName = null) {
    try {
      const conversation = await this.client.conversations.v1.conversations.create({
        friendlyName,
        uniqueName: uniqueName || `conversation_${Date.now()}`,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        attributes: JSON.stringify({
          createdAt: new Date().toISOString(),
          type: 'on_call_communication'
        })
      });

      return {
        success: true,
        conversationSid: conversation.sid,
        uniqueName: conversation.uniqueName,
        friendlyName: conversation.friendlyName,
        dateCreated: conversation.dateCreated
      };
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Add a participant to a conversation
   */
  async addParticipant(conversationSid, identity, phoneNumber = null) {
    try {
      const participantData = {
        identity,
      };

      if (phoneNumber) {
        participantData['messagingBinding.address'] = phoneNumber;
        participantData['messagingBinding.proxyAddress'] = process.env.TWILIO_PHONE_NUMBER;
      }

      const participant = await this.client.conversations.v1
        .conversations(conversationSid)
        .participants.create(participantData);

      return {
        success: true,
        participantSid: participant.sid,
        identity: participant.identity,
        dateCreated: participant.dateCreated
      };
    } catch (error) {
      console.error('Failed to add participant:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(conversationSid, body, author = null, mediaUrls = []) {
    try {
      const messageData = {
        body,
        author: author || 'system'
      };

      if (mediaUrls && mediaUrls.length > 0) {
        messageData.mediaUrl = mediaUrls;
      }

      const message = await this.client.conversations.v1
        .conversations(conversationSid)
        .messages.create(messageData);

      return {
        success: true,
        messageSid: message.sid,
        body: message.body,
        author: message.author,
        dateCreated: message.dateCreated,
        index: message.index
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Get conversation messages (with pagination)
   */
  async getMessages(conversationSid, limit = 50, order = 'desc') {
    try {
      const messages = await this.client.conversations.v1
        .conversations(conversationSid)
        .messages.list({
          limit,
          order
        });

      return {
        success: true,
        messages: messages.map(msg => ({
          sid: msg.sid,
          body: msg.body,
          author: msg.author,
          dateCreated: msg.dateCreated,
          index: msg.index,
          media: msg.media || [],
          participantSid: msg.participantSid,
          delivery: msg.delivery
        }))
      };
    } catch (error) {
      console.error('Failed to get messages:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Get conversation details
   */
  async getConversation(conversationSid) {
    try {
      const conversation = await this.client.conversations.v1
        .conversations(conversationSid)
        .fetch();

      const participants = await this.client.conversations.v1
        .conversations(conversationSid)
        .participants.list();

      return {
        success: true,
        conversation: {
          sid: conversation.sid,
          uniqueName: conversation.uniqueName,
          friendlyName: conversation.friendlyName,
          state: conversation.state,
          dateCreated: conversation.dateCreated,
          dateUpdated: conversation.dateUpdated,
          participants: participants.map(p => ({
            sid: p.sid,
            identity: p.identity,
            dateCreated: p.dateCreated,
            roleSid: p.roleSid
          }))
        }
      };
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Generate access token for client-side SDK
   */
  generateAccessToken(identity, conversationSid = null) {
    try {
      const { AccessToken } = twilio.jwt;
      const { ChatGrant } = AccessToken;

      const accessToken = new AccessToken(
        this.accountSid,
        process.env.TWILIO_API_KEY || this.accountSid,
        process.env.TWILIO_API_SECRET || this.authToken,
        { identity }
      );

      const chatGrant = new ChatGrant({
        serviceSid: process.env.TWILIO_CONVERSATIONS_SERVICE_SID,
        pushCredentialSid: process.env.TWILIO_PUSH_CREDENTIAL_SID
      });

      accessToken.addGrant(chatGrant);

      return {
        success: true,
        token: accessToken.toJwt(),
        identity
      };
    } catch (error) {
      console.error('Failed to generate access token:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find or create conversation for on-call communication
   */
  async findOrCreateOnCallConversation(userIdentity, onCallPersonPhone, onCallPersonName) {
    try {
      // Validate inputs
      if (!onCallPersonPhone) {
        return {
          success: false,
          error: 'Phone number is required for on-call conversation'
        };
      }

      // Try to find existing conversation
      const cleanPhone = onCallPersonPhone.replace(/\D/g, '');
      const uniqueName = `oncall_${userIdentity}_${cleanPhone}`;
      
      let conversation;
      try {
        conversation = await this.client.conversations.v1
          .conversations(uniqueName)
          .fetch();
      } catch (error) {
        if (error.status === 404) {
          // Conversation doesn't exist, create new one
          const createResult = await this.createConversation(
            `On-Call Chat with ${onCallPersonName}`,
            uniqueName
          );
          
          if (!createResult.success) {
            return createResult;
          }

          // Add both participants
          await this.addParticipant(createResult.conversationSid, userIdentity);
          // Note: SMS participants are added automatically when messages are sent
          // so we don't need to explicitly add the phone number participant

          conversation = { sid: createResult.conversationSid };
        } else {
          throw error;
        }
      }

      return {
        success: true,
        conversationSid: conversation.sid,
        isNewConversation: !conversation.dateCreated
      };
    } catch (error) {
      console.error('Failed to find or create on-call conversation:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userIdentity) {
    try {
      const conversations = await this.client.conversations.v1.conversations.list({
        limit: 50
      });

      const userConversations = [];
      
      for (const conv of conversations) {
        const participants = await this.client.conversations.v1
          .conversations(conv.sid)
          .participants.list();
        
        const hasUser = participants.some(p => p.identity === userIdentity);
        if (hasUser) {
          userConversations.push({
            sid: conv.sid,
            uniqueName: conv.uniqueName,
            friendlyName: conv.friendlyName,
            state: conv.state,
            dateCreated: conv.dateCreated,
            dateUpdated: conv.dateUpdated,
            participants: participants.map(p => ({
              identity: p.identity,
              dateCreated: p.dateCreated
            }))
          });
        }
      }

      return {
        success: true,
        conversations: userConversations
      };
    } catch (error) {
      console.error('Failed to get user conversations:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Close/delete a conversation
   */
  async closeConversation(conversationSid) {
    try {
      await this.client.conversations.v1
        .conversations(conversationSid)
        .update({ state: 'closed' });

      return {
        success: true,
        message: 'Conversation closed successfully'
      };
    } catch (error) {
      console.error('Failed to close conversation:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }
}

export default TwilioConversationsService;