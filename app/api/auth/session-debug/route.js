import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

export async function GET(req) {
  try {
    console.log('🔍 Session Debug - Request headers:', {
      cookie: req.headers.get('cookie')?.substring(0, 100),
      userAgent: req.headers.get('user-agent')?.substring(0, 50),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
    });

    console.log('🔍 Session Debug - Environment check:', {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      runtime: process.env.NODE_ENV,
    });

    const sessionManager = new SessionManager();
    let session;
    let sessionError = null;

    try {
      session = await sessionManager.getSessionFromRequest(req);
      console.log('🔍 Session Debug - Session result:', {
        hasSession: !!session,
        sessionType: typeof session,
        sessionKeys: session ? Object.keys(session) : [],
        hasUser: !!session?.user,
        userKeys: session?.user ? Object.keys(session.user) : [],
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        expires: session?.expires,
      });
    } catch (error) {
      console.error('🔥 Session Debug - Session error:', error);
      sessionError = {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 5),
      };
    }

    // Parse cookies for debug info
    const cookieHeader = req.headers.get('cookie');
    const cookies = {};
    if (cookieHeader) {
      cookieHeader.split('; ').forEach(cookie => {
        const [name, value] = cookie.split('=');
        cookies[name] = value?.substring(0, 50); // Truncate for security
      });
    }

    return NextResponse.json({
      success: !!session?.user?.email,
      timestamp: new Date().toISOString(),
      authSystem: 'custom-session-manager',
      session: {
        exists: !!session,
        hasUser: !!session?.user,
        hasEmail: !!session?.user?.email,
        email: session?.user?.email,
        name: session?.user?.name,
        image: session?.user?.image,
        expires: session?.expires,
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        runtime: 'edge',
      },
      request: {
        hasCookies: !!req.headers.get('cookie'),
        cookieLength: req.headers.get('cookie')?.length || 0,
        hasSessionToken: 'session-token' in cookies,
        sessionTokenLength: cookies['session-token']?.length || 0,
        cookieNames: Object.keys(cookies),
        origin: req.headers.get('origin'),
        referer: req.headers.get('referer'),
        userAgent: req.headers.get('user-agent')?.substring(0, 100),
      },
      error: sessionError,
      diagnostics: {
        message: session?.user?.email
          ? 'Custom session authentication successful'
          : sessionError
            ? 'Session parsing error occurred'
            : 'No valid session token found',
        possibleCauses: session?.user?.email
          ? []
          : sessionError
            ? [
                'Session token corrupted',
                'Session secret mismatch',
                'Cookie parsing error',
              ]
            : [
                'User not logged in',
                'Session expired',
                'session-token cookie not set',
                'Cookie not being sent',
              ],
      },
    });
  } catch (error) {
    console.error('🔥 Session Debug - Critical error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message,
          name: error.name,
          code: error.code,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
