import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import { hashPassword } from '../../../../lib/password-edge.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function POST(request) {
  // Credentials-based signup is disabled in favor of Google OAuth
  return NextResponse.json(
    {
      error:
        'Credentials-based signup is disabled. Please use Google OAuth to sign in.',
      redirectTo: '/api/auth/signin',
    },
    { status: 400 }
  );

  // Legacy code kept for reference but disabled
  /*
  try {
    const { email, password, name, organizationName } = await request.json();

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password using Edge Runtime compatible utility
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await db.createUser({
      email,
      name,
      password: hashedPassword,
      provider: 'credentials', // Mark as credentials for distinction from OAuth
    });

    // Create organization if provided
    let organization = null;
    if (organizationName) {
      const slug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      organization = await db.createOrganization(
        {
          name: organizationName,
          slug,
          created_by: user.id,
        },
        user.id
      ); // Pass user.id as second parameter

      // Organization creation already adds user as owner
    }

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        success: true,
        user: userWithoutPassword,
        organization,
        message:
          'Account created successfully. Please sign in with Google OAuth for future logins.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  */
}
