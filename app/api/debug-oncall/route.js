import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

const db = new SupabaseClient();

export async function GET(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Debug: Starting on-call schedule diagnostic...');
    console.log('🔍 Debug: User email:', session.user.email);

    const results = {
      user_email: session.user.email,
      user_lookup: null,
      user_organizations: [],
      raw_oncall_schedules: [],
      filtered_schedules: [],
      processing_errors: [],
    };

    // 1. Get user by email
    try {
      const user = await db.getUserByEmail(session.user.email);
      results.user_lookup = user;
      console.log('🔍 Debug: User lookup result:', user);

      if (!user) {
        return NextResponse.json({
          ...results,
          error: 'User not found',
        });
      }

      // 2. Get user's organizations
      const { data: userOrgs, error: memberError } = await db.client
        .from('organization_members')
        .select('organization_id, role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (memberError) {
        results.processing_errors.push(
          `Organization lookup error: ${memberError.message}`
        );
      } else {
        results.user_organizations = userOrgs || [];
        console.log('🔍 Debug: User organizations:', userOrgs);
      }

      if (!userOrgs || userOrgs.length === 0) {
        return NextResponse.json({
          ...results,
          message: 'User has no active organization memberships',
        });
      }

      const orgIds = userOrgs.map(o => o.organization_id);

      // 3. Get ALL on-call schedules (raw data)
      const { data: allSchedules, error: allSchedulesError } = await db.client
        .from('on_call_schedules')
        .select('*')
        .order('created_at', { ascending: false });

      if (allSchedulesError) {
        results.processing_errors.push(
          `All schedules error: ${allSchedulesError.message}`
        );
      } else {
        results.raw_oncall_schedules = allSchedules || [];
        console.log(
          '🔍 Debug: All schedules in database:',
          allSchedules?.length || 0
        );
      }

      // 4. Get schedules for user's organizations
      const { data: userSchedules, error: userSchedulesError } = await db.client
        .from('on_call_schedules')
        .select(
          `
          *,
          organizations(name)
        `
        )
        .in('organization_id', orgIds)
        .order('created_at', { ascending: false });

      if (userSchedulesError) {
        results.processing_errors.push(
          `User schedules error: ${userSchedulesError.message}`
        );
      } else {
        results.filtered_schedules = userSchedules || [];
        console.log('🔍 Debug: User schedules:', userSchedules?.length || 0);
      }

      // 5. Test the actual API method
      try {
        const apiResult = await db.getOnCallSchedules(user.id, {});
        results.api_method_result = {
          count: apiResult.length,
          schedules: apiResult,
        };
        console.log(
          '🔍 Debug: API method result:',
          apiResult.length,
          'schedules'
        );
      } catch (error) {
        results.processing_errors.push(`API method error: ${error.message}`);
      }

      // 6. Test with organization filter
      if (userOrgs.length > 0) {
        try {
          const orgFilterResult = await db.getOnCallSchedules(user.id, {
            organization_id: userOrgs[0].organization_id,
          });
          results.org_filtered_result = {
            organization_id: userOrgs[0].organization_id,
            count: orgFilterResult.length,
            schedules: orgFilterResult,
          };
          console.log(
            '🔍 Debug: Org filtered result:',
            orgFilterResult.length,
            'schedules'
          );
        } catch (error) {
          results.processing_errors.push(
            `Org filtered error: ${error.message}`
          );
        }
      }
    } catch (error) {
      results.processing_errors.push(`Main processing error: ${error.message}`);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('🔍 Debug: Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Debug endpoint failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
