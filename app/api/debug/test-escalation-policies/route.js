import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔍 Debug: Testing escalation policies access...');
    
    // Check authentication
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ User authenticated:', session.user.email);
    
    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    console.log('✅ User found:', user.id);
    
    // Check user organizations
    const { data: userOrgs, error: orgError } = await db.client
      .from('organization_members')
      .select('organization_id, organizations(name)')
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    console.log('👥 User organizations:', userOrgs);
    
    if (orgError) {
      console.error('Error fetching user organizations:', orgError);
      return NextResponse.json({ error: 'Failed to fetch user organizations', details: orgError.message }, { status: 500 });
    }
    
    // Try to fetch escalation policies using the admin client to bypass RLS
    const { data: allPolicies, error: allError } = await db.adminClient
      .from('escalation_policies')
      .select('*')
      .limit(10);
    
    console.log('📋 All escalation policies (admin):', allPolicies);
    
    if (allError) {
      console.error('Error fetching all policies:', allError);
    }
    
    // Try using the regular client
    const { data: userPolicies, error: userError } = await db.client
      .from('escalation_policies')
      .select('*')
      .limit(10);
    
    console.log('📋 User escalation policies:', userPolicies);
    
    if (userError) {
      console.error('Error fetching user policies:', userError);
    }
    
    // Try the database method
    let dbPolicies = [];
    let dbError = null;
    try {
      dbPolicies = await db.getEscalationPolicies(user.id);
    } catch (error) {
      dbError = error;
      console.error('Error using db method:', error);
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        user: {
          id: user.id,
          email: user.email
        },
        organizations: userOrgs,
        allPolicies: allPolicies || [],
        userPolicies: userPolicies || [],
        dbPolicies: dbPolicies || [],
        errors: {
          orgError: orgError?.message,
          allError: allError?.message,
          userError: userError?.message,
          dbError: dbError?.message
        }
      }
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Debug test failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}