import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

export async function POST() {
  try {
    console.log('🔵 Sign out requested');

    const sessionManager = new SessionManager();

    console.log('✅ User signed out');

    // Create response with cleared cookie from the start
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': sessionManager.clearSessionCookie(),
      },
    });
  } catch (error) {
    console.error('❌ Sign out error:', error);
    return Response.json({ error: 'Sign out failed' }, { status: 500 });
  }
}
