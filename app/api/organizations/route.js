import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    // Use our custom session manager instead of NextAuth
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);

    if (!session || !session.user?.email) {
      console.log('❌ No valid session found for organizations API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Valid session found for user:', session.user.email);

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      console.log('❌ User not found in database:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ User found in database:', user.id);

    // Get organizations for the authenticated user
    const organizations = await db.getOrganizations(user.id);
    console.log('📊 Organizations fetched for user:', organizations.length);

    return NextResponse.json({
      success: true,
      organizations: organizations,
      count: organizations.length,
    });
  } catch (error) {
    console.error('❌ Get organizations error:', error);
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
    // Use our custom session manager instead of NextAuth
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create organization
    const organization = await db.createOrganization({
      name,
      slug,
      created_by: user.id,
    });

    return NextResponse.json({
      success: true,
      organization: organization,
    });
  } catch (error) {
    console.error('Create organization error:', error);

    // Handle specific database errors
    if (error.message?.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'Organization name or slug already exists' },
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

export async function PUT(request) {
  try {
    // Use our custom session manager instead of NextAuth
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, slug } = body;

    // Validate required fields
    if (!id || !name || !slug) {
      return NextResponse.json(
        { error: 'ID, name, and slug are required' },
        { status: 400 }
      );
    }

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update organization
    const organization = await db.updateOrganization(id, {
      name,
      slug,
      updated_by: user.id,
    });

    return NextResponse.json({
      success: true,
      organization: organization,
    });
  } catch (error) {
    console.error('Update organization error:', error);

    if (error.message?.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'Organization name or slug already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update organization',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
