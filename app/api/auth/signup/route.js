import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import bcrypt from 'bcrypt';

const db = new SupabaseClient();

export async function POST(request) {
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.createUser({
      email,
      name,
      password: hashedPassword,
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
}
