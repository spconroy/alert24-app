import { auth } from '@/auth';
import { ApiResponse, Validator } from '@/lib/api-utils';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

/**
 * GET /api/user/default-organization
 * Get the current user's default organization
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiResponse.error('Authentication required', 401);
    }

    const { data, error } = await db.client
      .from('organization_members')
      .select(
        `
        organization_id,
        role,
        organizations!inner (
          id,
          name,
          slug
        )
      `
      )
      .eq('user_id', session.user.id)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching default organization:', error);
      return ApiResponse.error('Failed to fetch default organization', 500);
    }

    if (!data) {
      return ApiResponse.success({
        hasDefault: false,
        defaultOrganization: null,
      });
    }

    return ApiResponse.success({
      hasDefault: true,
      defaultOrganization: {
        id: data.organizations.id,
        name: data.organizations.name,
        slug: data.organizations.slug,
        role: data.role,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/user/default-organization:', error);
    return ApiResponse.error('Internal server error', 500);
  }
}

/**
 * POST /api/user/default-organization
 * Set a user's default organization
 * Body: { organizationId: string }
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiResponse.error('Authentication required', 401);
    }

    const body = await request.json();

    // Validate input
    Validator.required(['organizationId'], body);

    const { organizationId } = body;

    // Verify user is a member of this organization
    const { data: membership, error: membershipError } = await db.client
      .from('organization_members')
      .select('id, role')
      .eq('user_id', session.user.id)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership) {
      return ApiResponse.error(
        'You are not a member of this organization',
        403
      );
    }

    // First, remove default status from all user's organizations
    const { error: removeError } = await db.client
      .from('organization_members')
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.user.id);

    if (removeError) {
      console.error('Error removing default status:', removeError);
      return ApiResponse.error('Failed to update default organization', 500);
    }

    // Then set the specified organization as default
    const { error: setError } = await db.client
      .from('organization_members')
      .update({
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.user.id)
      .eq('organization_id', organizationId);

    if (setError) {
      console.error('Error setting default organization:', setError);
      return ApiResponse.error('Failed to set default organization', 500);
    }

    // Fetch the updated organization details
    const { data: orgData, error: orgError } = await db.client
      .from('organizations')
      .select('id, name, slug')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error('Error fetching organization details:', orgError);
      return ApiResponse.error('Failed to fetch organization details', 500);
    }

    return ApiResponse.success({
      message: 'Default organization updated successfully',
      defaultOrganization: {
        id: orgData.id,
        name: orgData.name,
        slug: orgData.slug,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/user/default-organization:', error);
    return ApiResponse.error('Internal server error', 500);
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
