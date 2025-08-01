import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔍 Teams API called');

    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      console.log('❌ No valid session found for teams API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Valid session found for teams API:', session.user.email);

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      console.log('❌ User not found in database:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ User found for teams API:', user.id);

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    console.log('🏢 Organization ID requested:', organizationId);

    if (!organizationId) {
      console.log('❌ No organization ID provided');
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Verify user has access to this organization
    const userOrgs = await db.getOrganizations(user.id);
    console.log(
      '📊 User organizations:',
      userOrgs.map(org => `${org.name} (${org.id})`)
    );

    const hasAccess = userOrgs.some(org => org.id === organizationId);
    if (!hasAccess) {
      console.log(
        '❌ User does not have access to organization:',
        organizationId
      );
      return NextResponse.json(
        { error: 'Access denied to organization' },
        { status: 403 }
      );
    }

    console.log('✅ User has access to organization, fetching teams...');

    // Use regular client since we have RLS policies in place
    const teams = await db.getTeamGroups(organizationId);
    console.log('👥 Teams found:', teams?.length || 0);

    // Get memberships for each team
    const teamsWithMembers = await Promise.all(
      teams.map(async team => {
        try {
          const memberships = await db.getTeamMemberships(team.id);
          console.log(
            `👤 Team "${team.name}" has ${memberships?.length || 0} members`
          );
          return {
            ...team,
            members: memberships,
          };
        } catch (memberError) {
          console.warn(
            `⚠️ Error fetching members for team ${team.id}:`,
            memberError
          );
          return {
            ...team,
            members: [],
          };
        }
      })
    );

    console.log('✅ Teams with members prepared:', teamsWithMembers.length);
    return NextResponse.json(teamsWithMembers);
  } catch (error) {
    console.error('❌ Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    console.log('🔍 Create team API called');

    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      console.log('❌ No valid session found for create team API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      console.log('❌ User not found in database:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, color, organizationId, teamLeadId } = body;

    console.log('🏗️ Creating team:', { name, organizationId });

    // Validate required fields
    if (!name || !organizationId) {
      console.log('❌ Missing required fields:', {
        name: !!name,
        organizationId: !!organizationId,
      });
      return NextResponse.json(
        { error: 'Team name and organization ID are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this organization
    const userOrgs = await db.getOrganizations(user.id);
    const hasAccess = userOrgs.some(org => org.id === organizationId);
    if (!hasAccess) {
      console.log(
        '❌ User does not have access to organization:',
        organizationId
      );
      return NextResponse.json(
        { error: 'Access denied to organization' },
        { status: 403 }
      );
    }

    // Create the team
    try {
      console.log('🏗️ Attempting to create team with data:', {
        name,
        description,
        color: color || '#0066CC',
        organization_id: organizationId,
        team_lead_id: teamLeadId || null,
        is_active: true,
      });

      const newTeam = await db.createTeamGroup({
        name,
        description,
        color: color || '#0066CC',
        organization_id: organizationId,
        team_lead_id: teamLeadId || null,
        is_active: true,
      }, user.id);

      console.log('✅ Team created successfully:', newTeam);
      return NextResponse.json(newTeam);
    } catch (createError) {
      console.error('❌ Team creation failed:', {
        error: createError.message,
        code: createError.code,
        details: createError.details,
        hint: createError.hint,
        name: createError.name,
      });

      return NextResponse.json(
        {
          error: 'Failed to create team',
          details: createError.message,
          code: createError.code,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error in teams API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
