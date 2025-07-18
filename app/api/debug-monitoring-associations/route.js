import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

const db = new SupabaseClient();

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Debug: Starting monitoring associations diagnostic...');

    const results = {
      user_email: session.user.email,
      failing_checks: [],
      service_associations: [],
      recent_check_results: [],
      service_statuses: [],
      processing_errors: [],
    };

    // 1. Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ ...results, error: 'User not found' });
    }

    // 2. Get user's organizations
    const { data: userOrgs, error: memberError } = await db.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (memberError) {
      results.processing_errors.push(
        `Organization lookup error: ${memberError.message}`
      );
      return NextResponse.json(results);
    }

    const orgIds = userOrgs.map(o => o.organization_id);

    // 3. Get failing monitoring checks
    const { data: failingChecks, error: checksError } = await db.client
      .from('monitoring_checks')
      .select('*')
      .in('organization_id', orgIds)
      .eq('current_status', 'down')
      .order('last_failure_at', { ascending: false });

    if (checksError) {
      results.processing_errors.push(
        `Failing checks error: ${checksError.message}`
      );
    } else {
      results.failing_checks = failingChecks || [];
      console.log(
        '🔍 Debug: Found failing checks:',
        failingChecks?.length || 0
      );
    }

    // 4. Get service monitoring associations
    const { data: associations, error: assocError } = await db.client
      .from('service_monitoring_checks')
      .select(
        `
        *,
        services(id, name, status, status_page_id),
        monitoring_checks(id, name, current_status, last_failure_at)
      `
      )
      .order('created_at', { ascending: false });

    if (assocError) {
      results.processing_errors.push(
        `Associations error: ${assocError.message}`
      );
    } else {
      results.service_associations = associations || [];
      console.log('🔍 Debug: Found associations:', associations?.length || 0);
    }

    // 5. Get recent check results for failing checks
    if (failingChecks && failingChecks.length > 0) {
      for (const check of failingChecks) {
        try {
          const { data: recentResults, error: resultsError } = await db.client
            .from('check_results')
            .select('*')
            .eq('monitoring_check_id', check.id)
            .order('created_at', { ascending: false })
            .limit(5);

          if (resultsError) {
            results.processing_errors.push(
              `Results error for check ${check.id}: ${resultsError.message}`
            );
          } else {
            results.recent_check_results.push({
              check_id: check.id,
              check_name: check.name,
              recent_results: recentResults || [],
            });
          }
        } catch (error) {
          results.processing_errors.push(
            `Error getting results for check ${check.id}: ${error.message}`
          );
        }
      }
    }

    // 6. Get services that should be affected
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select(
        `
        id, name, status, status_page_id, updated_at,
        status_pages(name, organization_id)
      `
      )
      .in('status_pages.organization_id', orgIds)
      .order('updated_at', { ascending: false });

    if (servicesError) {
      results.processing_errors.push(
        `Services error: ${servicesError.message}`
      );
    } else {
      results.service_statuses = services || [];
      console.log('🔍 Debug: Found services:', services?.length || 0);
    }

    // 7. Test association logic for failing checks
    if (failingChecks && failingChecks.length > 0) {
      results.association_analysis = [];

      for (const check of failingChecks) {
        try {
          // Find associations for this check
          const checkAssociations =
            associations?.filter(a => a.monitoring_check_id === check.id) || [];

          // Analyze why service status might not be updating
          const analysis = {
            check_id: check.id,
            check_name: check.name,
            check_status: check.current_status,
            last_failure: check.last_failure_at,
            consecutive_failures: check.consecutive_failures,
            associations_count: checkAssociations.length,
            associations: checkAssociations.map(a => ({
              service_id: a.service_id,
              service_name: a.services?.name,
              service_current_status: a.services?.status,
              failure_threshold_minutes: a.failure_threshold_minutes,
              should_be_down: true, // Since check is failing
            })),
          };

          results.association_analysis.push(analysis);
        } catch (error) {
          results.processing_errors.push(
            `Analysis error for check ${check.id}: ${error.message}`
          );
        }
      }
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
