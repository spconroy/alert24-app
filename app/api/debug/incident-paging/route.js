import { NextResponse } from 'next/server';
import { db } from '@/lib/db-supabase';
import { Auth } from '@/lib/api-utils';

export const runtime = 'edge';

export const GET = async (request) => {
  try {
    const session = await Auth.requireAuth(request);
    const user = await Auth.requireUser(db, session.user.email);

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check escalation policies
    const escalationPolicies = await db.getEscalationPolicies(user.id, { organization_id: organizationId });
    
    // Check recent incidents
    const incidents = await db.getIncidentsByOrganization(organizationId);
    const recentIncidents = incidents.slice(0, 5);
    
    // Check user details
    const userDetails = await db.getUserById(user.id);
    
    // Check organization details
    const organization = await db.getOrganizationById(organizationId);

    const debugInfo = {
      user: {
        id: user.id,
        email: user.email,
        name: userDetails.name,
        phone: userDetails.phone,
      },
      organization: {
        id: organizationId,
        name: organization?.name,
      },
      escalationPolicies: {
        count: escalationPolicies.length,
        policies: escalationPolicies.map(p => ({
          id: p.id,
          name: p.name,
          is_default: p.is_default,
          is_active: p.is_active,
          rules: p.escalation_steps,
        })),
      },
      recentIncidents: recentIncidents.map(i => ({
        id: i.id,
        title: i.title,
        status: i.status,
        severity: i.severity,
        assigned_to: i.assigned_to,
        escalation_policy_id: i.escalation_policy_id,
        created_at: i.created_at,
      })),
    };

    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};