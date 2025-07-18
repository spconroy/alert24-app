import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

// GET /api/billing - Get current billing information
export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is member of the organization
    const membership = await db.getOrganizationMember(organizationId, user.id);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Get organization with billing info
    const { data: organization, error } = await db.client
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get current usage stats
    const [teamMembersCount, monitoringChecksCount, activeIncidentsCount, statusPagesCount] =
      await Promise.all([
        db.client
          .from('organization_members')
          .select('id', { count: 'exact' })
          .eq('organization_id', organizationId)
          .eq('is_active', true),
        db.client
          .from('monitoring_checks')
          .select('id', { count: 'exact' })
          .eq('organization_id', organizationId)
          .eq('status', 'active'),
        db.client
          .from('incidents')
          .select('id', { count: 'exact' })
          .eq('organization_id', organizationId)
          .neq('status', 'resolved'),
        db.client
          .from('status_pages')
          .select('id', { count: 'exact' })
          .eq('organization_id', organizationId)
          .is('deleted_at', null),
      ]);

    const subscription = {
      plan: organization.subscription_plan,
      status: organization.subscription_status,
      current_period_start: organization.current_period_start,
      current_period_end: organization.current_period_end,
      stripe_customer_id: organization.stripe_customer_id,
      stripe_subscription_id: organization.stripe_subscription_id,
    };

    const usage = {
      team_members: teamMembersCount.count || 0,
      monitoring_checks: monitoringChecksCount.count || 0,
      active_incidents: activeIncidentsCount.count || 0,
      status_pages: statusPagesCount.count || 0,
    };

    return NextResponse.json({
      success: true,
      subscription,
      usage,
      organization: {
        id: organization.id,
        name: organization.name,
        max_team_members: organization.max_team_members,
        max_projects: organization.max_projects,
      },
    });
  } catch (error) {
    console.error('Error fetching billing info:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch billing information',
        details: error.message,
      },
      { status: 500 }
    );
  }
}