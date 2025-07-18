export const runtime = 'edge';

export async function GET() {
  try {
    const googleConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID ? 'Present' : 'Missing',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Present' : 'Missing',
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? 'Present' : 'Missing',
      nextAuthUrl: process.env.NEXTAUTH_URL || 'Not set',
    };

    // Test Google OAuth endpoint
    let googleTestResult = null;
    try {
      if (process.env.GOOGLE_CLIENT_ID) {
        const googleUrl = `https://oauth2.googleapis.com/tokeninfo?client_id=${process.env.GOOGLE_CLIENT_ID}`;
        const response = await fetch(googleUrl);
        googleTestResult =
          response.status === 200 ? 'Valid' : `Invalid (${response.status})`;
      }
    } catch (error) {
      googleTestResult = `Error: ${error.message}`;
    }

    return Response.json({
      environment: 'Cloudflare Edge',
      timestamp: new Date().toISOString(),
      config: googleConfig,
      googleClientTest: googleTestResult,
      recommendations: [
        'Ensure GOOGLE_CLIENT_ID is set in Cloudflare Pages environment variables',
        'Ensure GOOGLE_CLIENT_SECRET is set in Cloudflare Pages environment variables',
        'Ensure NEXTAUTH_SECRET is set (generate with: openssl rand -base64 32)',
        'Verify NEXTAUTH_URL matches your deployed domain',
        'Check Google OAuth redirect URIs include: https://your-domain.pages.dev/api/auth/callback/google',
      ],
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
