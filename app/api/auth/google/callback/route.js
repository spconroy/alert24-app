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
    } else {
      console.log('👤 Updating existing user profile picture');
      const { data: updatedUser, error: updateError } = await db.client
        .from('users')
        .update({
          avatar_url: googleUser.picture,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating user profile picture:', updateError);
        // Don't fail the login, just log the error
      } else {
        user = updatedUser;
      }
    }

    // Check for authorized domains and auto-enroll user
    console.log('🔄 Checking for authorized domains');
    try {
      const { data: authorizedDomains, error: domainError } =
        await db.client.rpc('check_authorized_domain', {
          email_address: user.email,
        });

      if (!domainError && authorizedDomains && authorizedDomains.length > 0) {
        console.log('✅ Found authorized domain(s) for:', user.email);

        // Auto-enroll user in each organization with authorized domain
        for (const domain of authorizedDomains) {
          console.log(
            `🔄 Auto-enrolling user in organization: ${domain.organization_name}`
          );

          // Use the database function to enroll user
          const { data: enrollmentResult, error: enrollmentError } =
            await db.client.rpc('enroll_user_via_domain', {
              p_user_id: user.id,
              p_email: user.email,
              p_ip_address: null, // Could extract from request if needed
              p_user_agent: null, // Could extract from request if needed
            });

          if (enrollmentError) {
            console.error('❌ Error auto-enrolling user:', enrollmentError);
          } else if (
            enrollmentResult &&
            enrollmentResult.length > 0 &&
            enrollmentResult[0].success
          ) {
            console.log(
              `✅ Successfully auto-enrolled user as ${enrollmentResult[0].role} in organization ${enrollmentResult[0].organization_id}`
            );
          } else {
            console.log(
              `ℹ️ Auto-enrollment skipped: ${enrollmentResult?.[0]?.message || 'Unknown reason'}`
            );
          }
        }
      } else {
        console.log('ℹ️ No authorized domains found for:', user.email);
      }
    } catch (domainCheckError) {
      console.error('❌ Error checking authorized domains:', domainCheckError);
      // Don't fail the login process if domain checking fails
    }

    // Create session
    console.log('🔄 Creating session');
    const sessionToken = await sessionManager.createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.avatar_url,
    });

    // Create redirect response with cookie header included from the start
    console.log('✅ Authentication successful, redirecting to app');
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${process.env.NEXTAUTH_URL}/`,
        'Set-Cookie': sessionManager.createSessionCookie(sessionToken),
      },
    });
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    return Response.redirect(
      `${process.env.NEXTAUTH_URL}/auth/error?error=OAuthCallback`
    );
  }
}
