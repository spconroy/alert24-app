import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

export async function POST() {
  try {
    console.log('🔵 Sign out requested');

    const sessionManager = new SessionManager();

    const response = Response.json({ success: true });
    response.headers.set('Set-Cookie', sessionManager.clearSessionCookie());

    console.log('✅ User signed out');
    return response;
  } catch (error) {
    console.error('❌ Sign out error:', error);
    return Response.json({ error: 'Sign out failed' }, { status: 500 });
  }
}
