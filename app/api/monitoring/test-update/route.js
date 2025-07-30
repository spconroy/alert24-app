import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function POST(req) {
  try {
    console.log('🧪 Testing monitoring update functionality...');
    
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { checkId } = body;
    
    if (!checkId) {
      return NextResponse.json({ error: 'checkId required' }, { status: 400 });
    }

    console.log('🔍 Testing database connection...');
    const testConnection = await db.testConnection();
    console.log('🔍 Connection test result:', testConnection);

    console.log('👤 Testing user lookup...');
    const user = await db.getUserByEmail(session.user.email);
    console.log('👤 User lookup result:', { hasUser: !!user });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('🔍 Testing monitoring check lookup...');
    const check = await db.getMonitoringCheckById(checkId);
    console.log('🔍 Check lookup result:', { hasCheck: !!check, checkName: check?.name });

    if (!check) {
      return NextResponse.json({ error: 'Check not found' }, { status: 404 });
    }

    console.log('🏢 Testing organization membership...');
    const membership = await db.getOrganizationMember(check.organization_id, user.id);
    console.log('🏢 Membership result:', { hasMembership: !!membership, role: membership?.role });

    console.log('💾 Testing simple database update...');
    const testUpdateData = { 
      name: check.name + ' (updated ' + new Date().toLocaleTimeString() + ')',
      updated_at: new Date().toISOString() 
    };
    
    const result = await db.updateMonitoringCheck(checkId, testUpdateData);
    console.log('💾 Update result:', { success: !!result });

    return NextResponse.json({
      success: true,
      message: 'Test completed successfully',
      results: {
        connection: testConnection,
        hasUser: !!user,
        hasCheck: !!check,
        hasMembership: !!membership,
        updateSuccess: !!result
      }
    });

  } catch (error) {
    console.error('🚨 Test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      name: error.name
    }, { status: 500 });
  }
}