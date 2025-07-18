export const runtime = 'edge';

export async function GET() {
  try {
    console.log('🔍 Testing NextAuth providers configuration');

    // Test basic NextAuth import
    let nextAuthImport = 'Failed';
    try {
      const { auth } = await import('../../../../auth.js');
      nextAuthImport = 'Success';
    } catch (error) {
      nextAuthImport = `Failed: ${error.message}`;
    }

    // Test Google provider configuration
    const googleConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'Missing',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Configured' : 'Missing',
    };

    // Mock providers response (what NextAuth would return)
    const mockProviders = {
      google: {
        id: 'google',
        name: 'Google',
        type: 'oauth',
        signinUrl: '/api/auth/signin/google',
        callbackUrl: '/api/auth/callback/google',
      },
    };

    return Response.json({
      timestamp: new Date().toISOString(),
      nextAuthImport,
      googleConfig,
      providers: mockProviders,
      status:
        nextAuthImport === 'Success'
          ? 'NextAuth configuration is working'
          : 'NextAuth configuration failed',
      recommendations: [
        'If this works, try testing /api/auth/test-minimal next',
        "If this fails, there's an issue with the auth.js file",
        'Check that all NextAuth dependencies are properly installed',
      ],
    });
  } catch (error) {
    console.error('❌ Providers test failed:', error);
    return Response.json(
      {
        error: 'Providers test failed',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
