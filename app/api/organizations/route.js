import { NextResponse } from 'next/server';
import { auth } from '../../../auth.js';
import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get organizations for the authenticated user
    const organizations = await db.getOrganizations(user.id);
    return NextResponse.json({
      success: true,
      organizations: organizations,
      count: organizations.length,
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch organizations',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      );
    }

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if slug already exists using generic select
    const existingOrgs = await db.select('organizations', '*', { slug });
    if (existingOrgs.length > 0) {
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 409 }
      );
    }

    // Use the existing createOrganization method which handles membership
    const organization = await db.createOrganization(
      {
        name,
        slug,
        subscription_plan: 'free',
        max_team_members: 3,
        max_projects: 5,
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      organization: organization,
      message: 'Organization created successfully',
    });
  } catch (error) {
    console.error('Create organization error:', error);

    // Handle duplicate slug error
    if (
      error.message.includes('duplicate key') ||
      error.message.includes('already exists')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization slug already exists',
          details: error.message,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create organization',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
