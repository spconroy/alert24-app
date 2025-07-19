import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's notification preferences
    let { data: preferences } = await db.client
      .from('notification_preferences')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    // If no preferences exist, create default ones
    if (!preferences) {
      const defaultPreferences = {
        user_id: session.user.id,
        email_invitations: true,
        email_incidents: true,
        email_monitoring: true,
        email_updates: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newPreferences, error } = await db.client
        .from('notification_preferences')
        .insert(defaultPreferences)
        .select()
        .single();

      if (error) {
        console.error('Error creating default preferences:', error);
        return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 });
      }

      preferences = newPreferences;
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Error in notification preferences GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const {
      email_invitations,
      email_incidents,
      email_monitoring,
      email_updates,
    } = data;

    // Validate input
    if (
      typeof email_invitations !== 'boolean' ||
      typeof email_incidents !== 'boolean' ||
      typeof email_monitoring !== 'boolean' ||
      typeof email_updates !== 'boolean'
    ) {
      return NextResponse.json({ error: 'Invalid preference values' }, { status: 400 });
    }

    // Update preferences
    const { data: updatedPreferences, error } = await db.client
      .from('notification_preferences')
      .upsert({
        user_id: session.user.id,
        email_invitations,
        email_incidents,
        email_monitoring,
        email_updates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
    });
  } catch (error) {
    console.error('Error in notification preferences PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}