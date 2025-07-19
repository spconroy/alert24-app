import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

const sessionManager = new SessionManager();
const db = new SupabaseClient();

// GET /api/authorized-domains/[id]
// Get specific authorized domain details
export async function GET(request, { params }) {
  try {
    console.log('🔍 Fetching authorized domain:', params.id);

    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const domainId = params.id;
    if (!domainId) {
      return Response.json({ error: 'Domain ID is required' }, { status: 400 });
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the authorized domain with organization access check via RLS
    const { data: domain, error } = await db.client
      .from('authorized_domains')
      .select(
        `
        *,
        organization:organizations(id, name),
        created_by_user:users!authorized_domains_created_by_fkey(id, name, email)
      `
      )
      .eq('id', domainId)
      .single();

    if (error || !domain) {
      console.error('❌ Error fetching authorized domain:', error);
      return Response.json(
        { error: 'Authorized domain not found or access denied' },
        { status: 404 }
      );
    }

    console.log('✅ Found authorized domain:', domain.domain);
    return Response.json({ domain });
  } catch (error) {
    console.error('❌ Get authorized domain error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/authorized-domains/[id]
// Update an authorized domain
export async function PUT(request, { params }) {
  try {
    console.log('🔄 Updating authorized domain:', params.id);

    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const domainId = params.id;
    if (!domainId) {
      return Response.json({ error: 'Domain ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const {
      domain,
      description,
      autoRole,
      maxAutoEnrollments,
      requireVerification,
      isActive,
    } = body;

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the existing domain and check permissions
    const { data: existingDomain, error: fetchError } = await db.client
      .from('authorized_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (fetchError || !existingDomain) {
      return Response.json(
        { error: 'Authorized domain not found or access denied' },
        { status: 404 }
      );
    }

    // Check if user is admin or owner of the organization
    const { data: membership, error: membershipError } = await db.client
      .from('organization_members')
      .select('role')
      .eq('organization_id', existingDomain.organization_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: 'Organization not found or access denied' },
        { status: 403 }
      );
    }

    if (!['admin', 'owner'].includes(membership.role)) {
      return Response.json(
        { error: 'Only admins and owners can manage authorized domains' },
        { status: 403 }
      );
    }

    // Validate domain format if domain is being changed
    if (domain && domain !== existingDomain.domain) {
      const { data: isValidDomain, error: validationError } =
        await db.client.rpc('validate_domain_format', {
          domain_name: domain.toLowerCase().trim(),
        });

      if (validationError || !isValidDomain) {
        return Response.json(
          { error: 'Invalid domain format' },
          { status: 400 }
        );
      }
    }

    // Prepare update data - only include fields that are provided
    const updateData = {};
    if (domain !== undefined) updateData.domain = domain.toLowerCase().trim();
    if (description !== undefined) updateData.description = description;
    if (autoRole !== undefined) updateData.auto_role = autoRole;
    if (maxAutoEnrollments !== undefined)
      updateData.max_auto_enrollments = maxAutoEnrollments;
    if (requireVerification !== undefined)
      updateData.require_verification = requireVerification;
    if (isActive !== undefined) updateData.is_active = isActive;

    // Update the authorized domain
    const { data: updatedDomain, error: updateError } = await db.client
      .from('authorized_domains')
      .update(updateData)
      .eq('id', domainId)
      .select(
        `
        *,
        organization:organizations(id, name),
        created_by_user:users!authorized_domains_created_by_fkey(id, name, email)
      `
      )
      .single();

    if (updateError) {
      console.error('❌ Error updating authorized domain:', updateError);

      // Handle specific error cases
      if (updateError.code === '23505') {
        // Unique constraint violation
        return Response.json(
          { error: 'This domain is already authorized for this organization' },
          { status: 409 }
        );
      }

      return Response.json(
        { error: 'Failed to update authorized domain' },
        { status: 500 }
      );
    }

    console.log('✅ Updated authorized domain:', updatedDomain.domain);
    return Response.json({
      domain: updatedDomain,
      message: 'Authorized domain updated successfully',
    });
  } catch (error) {
    console.error('❌ Update authorized domain error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/authorized-domains/[id]
// Delete an authorized domain
export async function DELETE(request, { params }) {
  try {
    console.log('🗑️ Deleting authorized domain:', params.id);

    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const domainId = params.id;
    if (!domainId) {
      return Response.json({ error: 'Domain ID is required' }, { status: 400 });
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the existing domain and check permissions
    const { data: existingDomain, error: fetchError } = await db.client
      .from('authorized_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (fetchError || !existingDomain) {
      return Response.json(
        { error: 'Authorized domain not found or access denied' },
        { status: 404 }
      );
    }

    // Check if user is admin or owner of the organization
    const { data: membership, error: membershipError } = await db.client
      .from('organization_members')
      .select('role')
      .eq('organization_id', existingDomain.organization_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: 'Organization not found or access denied' },
        { status: 403 }
      );
    }

    if (!['admin', 'owner'].includes(membership.role)) {
      return Response.json(
        { error: 'Only admins and owners can manage authorized domains' },
        { status: 403 }
      );
    }

    // Delete the authorized domain
    const { error: deleteError } = await db.client
      .from('authorized_domains')
      .delete()
      .eq('id', domainId);

    if (deleteError) {
      console.error('❌ Error deleting authorized domain:', deleteError);
      return Response.json(
        { error: 'Failed to delete authorized domain' },
        { status: 500 }
      );
    }

    console.log('✅ Deleted authorized domain:', existingDomain.domain);
    return Response.json({
      message: 'Authorized domain deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete authorized domain error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
