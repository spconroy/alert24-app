import { GoogleOAuth } from '@/lib/google-oauth';

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔵 Google OAuth sign-in initiated');
    console.log('🔍 Environment check:', {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    });

    const googleOAuth = new GoogleOAuth();
    const authUrl = googleOAuth.getAuthUrl();

    console.log('✅ Redirecting to Google OAuth:', authUrl);

    // Create redirect response manually to avoid immutable Response.redirect() issues
    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
      },
    });
  } catch (error) {
    console.error('❌ Google OAuth sign-in error:', error);
    console.error('❌ Error stack:', error.stack);

    return new Response(
      JSON.stringify({
        error: 'OAuth signin failed',
        message: error.message,
        details: error.stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
