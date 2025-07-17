import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const userId = searchParams.get('userId');

    if (email) {
      const user = await db.users.findByEmail(email);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      return NextResponse.json({ user: userWithoutPassword });
    }

    if (userId) {
      const user = await db.users.findById(userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      return NextResponse.json({ user: userWithoutPassword });
    }

    return NextResponse.json(
      { error: 'Email or userId parameter is required' },
      { status: 400 }
    );
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
    const {
      userId,
      name,
      email,
      avatarUrl,
      timezone,
      language,
      phoneNumber,
      emailNotificationsEnabled,
      pushNotificationsEnabled,
      notificationPreferences,
    } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (language !== undefined) updateData.language = language;
    if (phoneNumber !== undefined) updateData.phone_number = phoneNumber;
    if (emailNotificationsEnabled !== undefined)
      updateData.email_notifications_enabled = emailNotificationsEnabled;
    if (pushNotificationsEnabled !== undefined)
      updateData.push_notifications_enabled = pushNotificationsEnabled;
    if (notificationPreferences !== undefined)
      updateData.notification_preferences = notificationPreferences;

    const user = await db.users.update(userId, updateData);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
