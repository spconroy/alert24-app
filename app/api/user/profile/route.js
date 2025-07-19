import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    // Get session
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return user profile (SupabaseClient already excludes sensitive fields)
    return NextResponse.json({
      success: true,
      user: user,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    // Get session
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user
    const currentUser = await db.getUserByEmail(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const {
      name,
      email,
      avatarUrl,
      timezone,
      language,
      phone, // Frontend sends 'phone'
      phoneNumber, // Also support 'phoneNumber' for compatibility
      emailNotificationsEnabled,
      pushNotificationsEnabled,
      notification_preferences, // Frontend sends 'notification_preferences'
      notificationPreferences, // Also support camelCase for compatibility
    } = await request.json();

    // Build update data object
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (language !== undefined) updateData.language = language;

    // Handle phone number (support both naming conventions)
    const phoneValue = phone !== undefined ? phone : phoneNumber;
    if (phoneValue !== undefined) updateData.phone_number = phoneValue;

    if (emailNotificationsEnabled !== undefined)
      updateData.email_notifications_enabled = emailNotificationsEnabled;
    if (pushNotificationsEnabled !== undefined)
      updateData.push_notifications_enabled = pushNotificationsEnabled;

    // Handle notification preferences (support both naming conventions)
    const notificationPrefs =
      notification_preferences !== undefined
        ? notification_preferences
        : notificationPreferences;
    if (notificationPrefs !== undefined)
      updateData.notification_preferences = notificationPrefs;

    // Update user in database
    const { data: updatedUser, error } = await db.client
      .from('users')
      .update(updateData)
      .eq('id', currentUser.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
