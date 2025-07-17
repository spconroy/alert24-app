import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const isPublic = searchParams.get('public');

    if (isPublic === 'true') {
      // Get all public status pages
      const statusPages = await db.statusPages.findPublic();
      return NextResponse.json({ statusPages });
    }

    if (organizationId) {
      // Get status pages for a specific organization
      const statusPages =
        await db.statusPages.findByOrganizationId(organizationId);
      return NextResponse.json({ statusPages });
    }

    // Get all status pages (with proper filtering)
    const statusPages = await db.statusPages.findAll();
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
    const {
      organizationId,
      name,
      slug,
      description,
      isPublic = true,
    } = await request.json();

    // Validate required fields
    if (!organizationId || !name || !slug) {
      return NextResponse.json(
        { error: 'Organization ID, name, and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug is unique within the organization
    const existingPage = await db.statusPages.findBySlug(organizationId, slug);
    if (existingPage) {
      return NextResponse.json(
        {
          error:
            'A status page with this slug already exists in this organization',
        },
        { status: 400 }
      );
    }

    // Create status page
    const statusPage = await db.statusPages.create({
      organization_id: organizationId,
      name,
      slug,
      description,
      is_public: isPublic,
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
    const { id, name, slug, description, isPublic } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Status page ID is required' },
        { status: 400 }
      );
    }

    const statusPage = await db.statusPages.update(id, {
      name,
      slug,
      description,
      is_public: isPublic,
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Status page ID is required' },
        { status: 400 }
      );
    }

    await db.statusPages.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting status page:', error);
    return NextResponse.json(
      { error: 'Failed to delete status page' },
      { status: 500 }
    );
  }
}
