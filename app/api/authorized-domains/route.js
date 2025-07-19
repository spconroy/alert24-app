import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

const sessionManager = new SessionManager();
const db = new SupabaseClient();

// GET /api/authorized-domains
// List authorized domains for user's organizations
export async function GET(request) {
  try {
    console.log('🔍 Fetching authorized domains');

    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    let query = db.client
      .from('authorized_domains')
      .select(
        `
        *,
        organization:organizations(id, name),
        created_by_user:users!authorized_domains_created_by_fkey(id, name, email)
      `
      )
      .order('created_at', { ascending: false });

    // Filter by organization if specified
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: domains, error } = await query;

    if (error) {
      console.error('❌ Error fetching authorized domains:', error);
      return Response.json(
        { error: 'Failed to fetch authorized domains' },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${domains.length} authorized domains`);
    return Response.json({
      domains: domains || [],
      count: domains?.length || 0,
    });
  } catch (error) {
    console.error('❌ Authorized domains API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/authorized-domains
// Create a new authorized domain
export async function POST(request) {
  try {
    console.log('🔄 Creating authorized domain');

    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      organizationId,
      domain,
      description,
      autoRole = 'member',
      maxAutoEnrollments = null,
      requireVerification = true,
    } = body;

    // Validate required fields
    if (!organizationId || !domain) {
      return Response.json(
        { error: 'Organization ID and domain are required' },
        { status: 400 }
      );
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is admin or owner of the organization
    const { data: membership, error: membershipError } = await db.client
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
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

    // Validate domain format using database function
    const { data: isValidDomain, error: validationError } = await db.client.rpc(
      'validate_domain_format',
      { domain_name: domain.toLowerCase().trim() }
    );

    if (validationError || !isValidDomain) {
      return Response.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Create the authorized domain
    const domainData = {
      organization_id: organizationId,
      domain: domain.toLowerCase().trim(),
      description: description || null,
      auto_role: autoRole,
      max_auto_enrollments: maxAutoEnrollments,
      require_verification: requireVerification,
      created_by: user.id,
      is_active: true,
    };

    const { data: newDomain, error: createError } = await db.client
      .from('authorized_domains')
      .insert(domainData)
      .select(
        `
        *,
        organization:organizations(id, name),
        created_by_user:users!authorized_domains_created_by_fkey(id, name, email)
      `
      )
      .single();

    if (createError) {
      console.error('❌ Error creating authorized domain:', createError);

      // Handle specific error cases
      if (createError.code === '23505') {
        // Unique constraint violation
        return Response.json(
          { error: 'This domain is already authorized for this organization' },
          { status: 409 }
        );
      }

      return Response.json(
        { error: 'Failed to create authorized domain' },
        { status: 500 }
      );
    }

    console.log('✅ Created authorized domain:', newDomain.domain);
    return Response.json(
      {
        domain: newDomain,
        message: 'Authorized domain created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Create authorized domain error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
