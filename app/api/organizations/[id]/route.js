import { NextResponse } from 'next/server';
import { auth } from '@/auth';

import { SupabaseClient } from '../../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = params.id;
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is a member of the organization
    const { data: membership, error: membershipError } = await db.client
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Forbidden - Not a member of this organization' },
        { status: 403 }
      );
    }

    // Get organization details
    const { data: organization, error: orgError } = await db.client
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get all active members and their roles
    // Include owners even if they haven't "accepted" since they created the org
    const { data: members, error: membersError } = await db.client
      .from('organization_members')
      .select(
        `
        id,
        role,
        is_active,
        accepted_at,
        users!organization_members_user_id_fkey (
          id,
          email,
          name
        )
      `
      )
      .eq('organization_id', orgId)
      .or(
        'and(is_active.eq.true,accepted_at.not.is.null),and(is_active.eq.true,role.eq.owner)'
      )
      .order('role', { ascending: false });

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    const transformedMembers = members.map(member => ({
      id: member.users.id,
      email: member.users.email,
      name: member.users.name,
      role: member.role,
      is_active: member.is_active,
      accepted_at: member.accepted_at,
    }));

    return NextResponse.json({
      organization: organization,
      members: transformedMembers,
    });
  } catch (error) {
    console.error('GET organization error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { name, slug, domain, logo_url, primary_color, secondary_color } =
      body;

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is a member of the organization
    const { data: membership, error: membershipError } = await db.client
      .from('organization_members')
      .select('*')
      .eq('organization_id', id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Forbidden - Not a member of this organization' },
        { status: 403 }
      );
    }

    // Update organization
    const { data: org, error: orgError } = await db.client
      .from('organizations')
      .update({
        name,
        slug,
        domain,
        logo_url,
        primary_color,
        secondary_color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (orgError) {
      throw orgError;
    }

    return NextResponse.json({ organization: org });
  } catch (error) {
    console.error('PUT organization error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = params.id;

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is OWNER of the organization
    const { data: membership, error: membershipError } = await db.client
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only organization owners can delete organizations' },
        { status: 403 }
      );
    }

    // Get organization details before deletion
    const { data: org, error: orgError } = await db.client
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Delete organization (CASCADE should handle related data)
    const { error: deleteError } = await db.client
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (deleteError) {
      throw deleteError;
    }

    console.log(
      `Organization "${org.name}" (${orgId}) deleted by user ${session.user.email}`
    );

    return NextResponse.json({
      message: 'Organization deleted successfully',
      deletedOrganization: { id: orgId, name: org.name },
    });
  } catch (error) {
    console.error('DELETE organization error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
