import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔍 Debug endpoint called');

    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);

    const debugInfo = {
      timestamp: new Date().toISOString(),
      session: session,
      environment: {
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV,
        runtime: 'edge',
      },
    };

    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

    return Response.json(debugInfo);
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
