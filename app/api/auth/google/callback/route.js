import { GoogleOAuth } from '@/lib/google-oauth';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔵 Google OAuth callback received');

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('❌ OAuth error:', error);
      return Response.redirect(
        `${process.env.NEXTAUTH_URL}/auth/error?error=OAuthCallback`
      );
    }

    if (!code) {
      console.error('❌ No authorization code received');
      return Response.redirect(
        `${process.env.NEXTAUTH_URL}/auth/error?error=OAuthCallback`
      );
    }

    const googleOAuth = new GoogleOAuth();
    const sessionManager = new SessionManager();

    // Exchange code for token
    console.log('🔄 Exchanging code for token');
    const tokenData = await googleOAuth.exchangeCodeForToken(code);

    // Get user info from Google
    console.log('🔄 Fetching user info');
    const googleUser = await googleOAuth.getUserInfo(tokenData.access_token);

    console.log('✅ Google user info:', {
      email: googleUser.email,
      name: googleUser.name,
    });

    // Create or update user in our database
    const db = new SupabaseClient();
    let user = await db.getUserByEmail(googleUser.email);

    if (!user) {
      console.log('👤 Creating new user');
      const userData = {
        name: googleUser.name,
        email: googleUser.email,
        avatar_url: googleUser.picture,
        google_oauth_id: googleUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newUser, error: createError } = await db.client
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating user:', createError);
        return Response.redirect(
          `${process.env.NEXTAUTH_URL}/auth/error?error=OAuthCreateAccount`
        );
      }

      user = newUser;
    }

    // Create session
    console.log('🔄 Creating session');
    const sessionToken = await sessionManager.createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.avatar_url,
    });

    // Set cookie and redirect
    const response = Response.redirect(`${process.env.NEXTAUTH_URL}/`);
    response.headers.set(
      'Set-Cookie',
      sessionManager.createSessionCookie(sessionToken)
    );

    console.log('✅ Authentication successful, redirecting to app');
    return response;
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    return Response.redirect(
      `${process.env.NEXTAUTH_URL}/auth/error?error=OAuthCallback`
    );
  }
}
