import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // Get organizations for specific user
      const organizations = await db.getOrganizations(userId);
      return NextResponse.json({
        success: true,
        organizations: organizations,
        count: organizations.length,
      });
    } else {
      // For now, return all organizations using generic select method
      const organizations = await db.select('organizations');
      return NextResponse.json({
        success: true,
        organizations: organizations,
        count: organizations.length,
      });
    }
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
    const body = await request.json();
    const { name, slug, userId } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists using generic select
    const existingOrgs = await db.select('organizations', '*', { slug });
    if (existingOrgs.length > 0) {
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 409 }
      );
    }

    if (userId) {
      // Use the existing createOrganization method which handles membership
      const organization = await db.createOrganization(
        {
          name,
          slug,
          subscription_plan: 'free',
          max_team_members: 3,
          max_projects: 5,
        },
        userId
      );

      return NextResponse.json({
        success: true,
        organization: organization,
        message: 'Organization created successfully',
      });
    } else {
      // Just create organization without membership
      const organization = await db.insert('organizations', {
        name,
        slug,
        subscription_plan: 'free',
        max_team_members: 3,
        max_projects: 5,
      });

      return NextResponse.json({
        success: true,
        organization: organization,
        message: 'Organization created successfully',
      });
    }
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
