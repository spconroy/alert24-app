import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req) {
  try {
    // Test authentication
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    // Test database connection
    const testConnection = await db.testConnection();

    // Test user fetch
    let userTest = null;
    let userError = null;

    try {
      const user = await db.getUserByEmail(session.user.email);
      if (user) {
        userTest = {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone_number: user.phone_number,
            timezone: user.timezone,
            notification_preferences: user.notification_preferences,
          },
        };
      } else {
        userError = { error: 'User not found in database' };
      }
    } catch (err) {
      userError = err;
    }

    // Test profile update
    let updateTest = null;
    let updateError = null;

    try {
      const user = await db.getUserByEmail(session.user.email);
      if (user) {
        const { data: updatedUser, error } = await db.client
          .from('users')
          .update({
            updated_at: new Date().toISOString(),
            name: user.name || 'Test User',
          })
          .eq('id', user.id)
          .select()
          .single();

        if (error) {
          updateError = error;
        } else {
          updateTest = { success: true, updated: true };
        }
      }
    } catch (err) {
      updateError = err;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: {
        user: session.user,
        authenticated: true,
      },
      tests: {
        connection: testConnection,
        userFetch: userTest || { success: false, error: userError },
        updateTest: updateTest || { success: false, error: updateError },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
