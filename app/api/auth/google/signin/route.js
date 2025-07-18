import { GoogleOAuth } from '@/lib/google-oauth';

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔵 Google OAuth sign-in initiated');

    const googleOAuth = new GoogleOAuth();
    const authUrl = googleOAuth.getAuthUrl();

    console.log('✅ Redirecting to Google OAuth:', authUrl);

    return Response.redirect(authUrl);
  } catch (error) {
    console.error('❌ Google OAuth sign-in error:', error);

    return Response.redirect(
      `${process.env.NEXTAUTH_URL}/auth/error?error=OAuthSignin`
    );
  }
}
