import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { SupabaseClient } from '../../../lib/db-supabase.js';
import { authOptions } from '../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId =
      searchParams.get('org_id') || searchParams.get('organizationId');
    const isPublic = searchParams.get('public');

    if (isPublic === 'true') {
      // Get all public status pages (not implemented yet, return empty for now)
      return NextResponse.json({ statusPages: [] });
    }

    if (organizationId) {
      // Get status pages for a specific organization
      const statusPages = await db.getStatusPagesByOrganization(organizationId);
      return NextResponse.json({ statusPages });
    }

    // Get all status pages for the user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const statusPages = await db.getAllStatusPagesForUser(user.id);
    return NextResponse.json({ statusPages });
  } catch (error) {
    console.error('Error fetching status pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status pages' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      organizationId,
      org_id, // Support both parameter names
      name,
      slug,
      description,
      isPublic = true,
      is_public = true,
    } = await request.json();

    const finalOrgId = organizationId || org_id;
    const finalIsPublic = isPublic !== undefined ? isPublic : is_public;

    // Validate required fields
    if (!finalOrgId || !name || !slug) {
      return NextResponse.json(
        { error: 'Organization ID, name, and slug are required' },
        { status: 400 }
      );
    }

    // Create status page using generic insert method
    const statusPage = await db.insert('status_pages', {
      organization_id: finalOrgId,
      name,
      slug,
      description,
      is_public: finalIsPublic,
    });

    return NextResponse.json({ statusPage }, { status: 201 });
  } catch (error) {
    console.error('Error creating status page:', error);
    return NextResponse.json(
      { error: 'Failed to create status page' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, slug, description, isPublic, is_public } =
      await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Status page ID is required' },
        { status: 400 }
      );
    }

    const finalIsPublic = isPublic !== undefined ? isPublic : is_public;

    const statusPage = await db.update('status_pages', id, {
      name,
      slug,
      description,
      is_public: finalIsPublic,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ statusPage });
  } catch (error) {
    console.error('Error updating status page:', error);
    return NextResponse.json(
      { error: 'Failed to update status page' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Status page ID is required' },
        { status: 400 }
      );
    }

    // Soft delete by setting deleted_at
    await db.update('status_pages', id, {
      deleted_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting status page:', error);
    return NextResponse.json(
      { error: 'Failed to delete status page' },
      { status: 500 }
    );
  }
}
