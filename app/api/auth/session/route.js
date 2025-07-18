import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔍 Session API called');

    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);

    if (!session) {
      console.log('❌ No session found');
      return Response.json(null);
    }

    console.log('✅ Session found for user:', session.user?.email);
    return Response.json(session);
  } catch (error) {
    console.error('❌ Session API error:', error);
    // Return null session instead of error to prevent auth loops
    return Response.json(null);
  }
}
