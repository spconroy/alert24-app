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

    // Get the user's default organization using Supabase client
    const { data: userData, error } = await db.client
      .from('users')
      .select('default_organization_id')
      .eq('id', user.id)
      .single();

    if (error) {
      console.log(
        '⚠️ Error fetching user default org (column might not exist):',
        error
      );
      return NextResponse.json({
        success: true,
        defaultOrganizationId: null,
      });
    }

    const defaultOrgId = userData?.default_organization_id;
    console.log('📋 User default organization ID:', defaultOrgId);

    if (!defaultOrgId) {
      return NextResponse.json({
        success: true,
        defaultOrganizationId: null,
      });
    }

    // Verify the organization exists and user has access
    const organizations = await db.getOrganizations(user.id);
    const defaultOrg = organizations.find(org => org.id === defaultOrgId);

    if (!defaultOrg) {
      console.log(
        '⚠️ Default organization not found or no access:',
        defaultOrgId
      );
      return NextResponse.json({
        success: true,
        defaultOrganizationId: null,
      });
    }

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

    // Validate that the user has access to this organization
    if (organizationId) {
      const organizations = await db.getOrganizations(user.id);
      const targetOrg = organizations.find(org => org.id === organizationId);

      if (!targetOrg) {
        console.log(
          '❌ User does not have access to organization:',
          organizationId
        );
        return NextResponse.json(
          { error: 'Organization not found or access denied' },
          { status: 403 }
        );
      }

      console.log('✅ User has access to organization:', targetOrg.name);
    }

    // Update the user's default organization using Supabase client
    const { error } = await db.client
      .from('users')
      .update({
        default_organization_id: organizationId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('❌ Error updating default organization:', error);

      // If column doesn't exist, try to add it
      if (
        error.message.includes(
          'column "default_organization_id" does not exist'
        )
      ) {
        console.log('🔧 Column does not exist, user must add it manually');
        return NextResponse.json(
          {
            error:
              'Database schema needs update - default_organization_id column missing',
            details:
              'Please add the column: ALTER TABLE alert24_schema.users ADD COLUMN default_organization_id UUID;',
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to set default organization',
          details: error.message,
        },
        { status: 500 }
      );
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
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiResponse.error('Authentication required', 401);
    }

    // Remove default status from all user's organizations
    const { error } = await db.client
      .from('organization_members')
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error removing default organization:', error);
      return ApiResponse.error('Failed to remove default organization', 500);
    }

    return ApiResponse.success({
      message: 'Default organization removed successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/user/default-organization:', error);
    return ApiResponse.error('Internal server error', 500);
  }
}
