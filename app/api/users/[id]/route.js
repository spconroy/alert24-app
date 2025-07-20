import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id: userId } = params;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Get user details
    const user = await db.getUserById(userId);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For security, only return essential contact information
    // Don't expose all user data unless authorized
    const publicUserData = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone_number,
      avatar_url: user.avatar_url,
    };

    return NextResponse.json({
      success: true,
      user: publicUserData,
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}