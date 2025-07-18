import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

async function getStatusPageAndCheckOrg(id, userEmail) {
  try {
    // Get user
    const user = await db.getUserByEmail(userEmail);
    if (!user) {
      return null;
    }

    // Get status page
    const statusPage = await db.getStatusPageById(id);
    if (!statusPage) {
      return null;
    }

    // Check organization membership
    const membership = await db.getOrganizationMember(
      statusPage.organization_id,
      user.id
    );
    if (!membership) {
      return null;
    }

    return statusPage;
  } catch (error) {
    console.error('Error checking status page access:', error);
    return null;
  }
}

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const statusPage = await getStatusPageAndCheckOrg(id, session.user.email);

    if (!statusPage) {
      return NextResponse.json(
        { error: 'Not found or forbidden' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      statusPage,
    });
  } catch (err) {
    console.error('Error fetching status page:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch status page',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    // Check access to status page
    const statusPage = await getStatusPageAndCheckOrg(id, session.user.email);

    if (!statusPage) {
      return NextResponse.json(
        { error: 'Not found or forbidden' },
        { status: 404 }
      );
    }

    // Update status page
    const updatedStatusPage = await db.updateStatusPage(id, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      statusPage: updatedStatusPage,
      message: 'Status page updated successfully',
    });
  } catch (err) {
    console.error('Error updating status page:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update status page',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check access to status page
    const statusPage = await getStatusPageAndCheckOrg(id, session.user.email);

    if (!statusPage) {
      return NextResponse.json(
        { error: 'Not found or forbidden' },
        { status: 404 }
      );
    }

    // Get user to check permissions
    const user = await db.getUserByEmail(session.user.email);
    const membership = await db.getOrganizationMember(
      statusPage.organization_id,
      user.id
    );

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        {
          error:
            'Access denied - only owners and admins can delete status pages',
        },
        { status: 403 }
      );
    }

    // Soft delete status page
    const deletedStatusPage = await db.deleteStatusPage(id);

    return NextResponse.json({
      success: true,
      statusPage: deletedStatusPage,
      message: 'Status page deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting status page:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete status page',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
