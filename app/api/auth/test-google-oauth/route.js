import { GoogleOAuth } from '@/lib/google-oauth';
import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

export async function GET() {
  try {
    console.log('🔍 Testing custom Google OAuth setup');

    // Test Google OAuth configuration
    const googleOAuth = new GoogleOAuth();
    const authUrl = googleOAuth.getAuthUrl('test-state');

    // Test Session Manager
    const sessionManager = new SessionManager();
    const testToken = await sessionManager.createSessionToken({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
    });

    const verifiedSession = await sessionManager.verifySessionToken(testToken);

    return Response.json({
      timestamp: new Date().toISOString(),
      status: 'Custom Google OAuth setup working',
      tests: {
        googleOAuthConfig: '✅ Working',
        authUrlGeneration: authUrl ? '✅ Working' : '❌ Failed',
        sessionTokenCreation: testToken ? '✅ Working' : '❌ Failed',
        sessionTokenVerification: verifiedSession ? '✅ Working' : '❌ Failed',
      },
      environment: {
        clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing',
        nextAuthUrl: process.env.NEXTAUTH_URL || 'Not set',
        nextAuthSecret: process.env.NEXTAUTH_SECRET ? 'Set' : 'Missing',
      },
      endpoints: {
        signin: '/api/auth/google/signin',
        callback: '/api/auth/google/callback',
        session: '/api/auth/session',
        signout: '/api/auth/signout',
      },
      googleOAuthRedirectUri: googleOAuth.redirectUri,
      nextSteps: [
        'Update Google Cloud Console redirect URIs',
        'Test the authentication flow',
        'Remove NextAuth dependencies if desired',
      ],
    });
  } catch (error) {
    console.error('❌ Custom Google OAuth test failed:', error);
    return Response.json(
      {
        error: 'Custom Google OAuth test failed',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
