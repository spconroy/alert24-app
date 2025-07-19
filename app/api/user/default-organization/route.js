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
      console.log('❌ No valid session found for default organization API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Valid session found for default org:', session.user.email);

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      console.log('❌ User not found in database:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ User found, checking default organization for:', user.id);

    // Get the user's default organization from organization_members table
    const { data: defaultMembership, error } = await db.client
      .from('organization_members')
      .select(
        `
        organization_id,
        organizations (
          id,
          name,
          slug
        )
      `
      )
      .eq('user_id', user.id)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      console.log('⚠️ Error fetching default organization membership:', error);
      return NextResponse.json({
        success: true,
        defaultOrganizationId: null,
      });
    }

    if (!defaultMembership) {
      console.log('📋 No default organization set');
      return NextResponse.json({
        success: true,
        defaultOrganizationId: null,
      });
    }

    const defaultOrgId = defaultMembership.organization_id;
    const defaultOrg = defaultMembership.organizations;

    console.log('✅ Default organization found:', defaultOrg.name);

    return NextResponse.json({
      success: true,
      defaultOrganizationId: defaultOrgId,
      defaultOrganization: defaultOrg,
    });
  } catch (error) {
    console.error('❌ Get default organization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch default organization',
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
      console.log('❌ No valid session found for setting default organization');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId } = body;

    console.log(
      '🎯 Setting default organization:',
      organizationId,
      'for user:',
      session.user.email
    );

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      console.log('❌ User not found in database:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate that the user has access to this organization (if organizationId is provided)
    if (organizationId) {
      const { data: membership, error: membershipError } = await db.client
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .single();

      if (membershipError || !membership) {
        console.log(
          '❌ User does not have access to organization:',
          organizationId
        );
        return NextResponse.json(
          { error: 'Organization not found or access denied' },
          { status: 403 }
        );
      }

      console.log('✅ User has access to organization:', organizationId);
    }

    // First, clear any existing default for this user
    const { error: clearError } = await db.client
      .from('organization_members')
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (clearError) {
      console.error('❌ Error clearing existing defaults:', clearError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to clear existing defaults',
          details: clearError.message,
        },
        { status: 500 }
      );
    }

    // If organizationId is provided, set it as default
    if (organizationId) {
      const { error: setError } = await db.client
        .from('organization_members')
        .update({
          is_default: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('organization_id', organizationId);

      if (setError) {
        console.error('❌ Error setting new default:', setError);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to set new default',
            details: setError.message,
          },
          { status: 500 }
        );
      }
    }

    console.log('✅ Default organization updated successfully');

    return NextResponse.json({
      success: true,
      defaultOrganizationId: organizationId,
      message: organizationId
        ? 'Default organization set successfully'
        : 'Default organization cleared successfully',
    });
  } catch (error) {
    console.error('❌ Set default organization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to set default organization',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/default-organization
 * Remove default organization setting (no organization will be default)
 */
export async function DELETE(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user by email from session
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove default status from all user's organizations
    const { error } = await db.client
      .from('organization_members')
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error removing default organization:', error);
      return NextResponse.json(
        {
          error: 'Failed to remove default organization',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Default organization removed successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/user/default-organization:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
