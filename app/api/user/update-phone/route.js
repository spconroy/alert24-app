import { NextResponse } from 'next/server';
import { Auth } from '@/lib/api-utils';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export async function POST(request) {
  try {
    const session = await Auth.requireAuth(request);
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user's phone number
    const { data, error } = await db.client
      .from('users')
      .update({ 
        phone_number: phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      user: data,
      message: 'Phone number updated successfully'
    });
  } catch (error) {
    console.error('Update phone error:', error);
    return NextResponse.json(
      { error: 'Failed to update phone number' },
      { status: 500 }
    );
  }
}