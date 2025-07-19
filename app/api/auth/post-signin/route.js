import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function POST(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);

    if (!session || !session.user?.email) {
      return Response.json(
        { error: 'No authenticated session' },
        { status: 401 }
      );
    }

    const db = new SupabaseClient();

    // Check if user exists in our database
    let existingUser = await db.getUserByEmail(session.user.email);

    if (!existingUser) {
      console.log('👤 Creating new user:', session.user.email);
      // Create new user if doesn't exist
      const userData = {
        name: session.user.name,
        email: session.user.email,
        avatar_url: session.user.image,
        google_oauth_id: session.user.email, // Use email as identifier
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newUser, error } = await db.client
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user:', error);
        return Response.json(
          {
            error: 'Failed to create user',
            details: error.message,
          },
          { status: 500 }
        );
      }

      existingUser = newUser;
      console.log('✅ User created successfully:', existingUser.id);
    }

    return Response.json({
      success: true,
      user: existingUser,
      message: 'User authenticated and ready',
    });
  } catch (error) {
    console.error('❌ Post-signin error:', error);
    return Response.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
