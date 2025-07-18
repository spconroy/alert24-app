import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔧 Starting manual service status sync...');

    const results = {
      services_updated: [],
      status_updates_posted: [],
      errors: [],
    };

    // 1. Get user and organizations
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: userOrgs } = await db.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const orgIds = userOrgs.map(o => o.organization_id);

    // 2. Get all service monitoring associations
    const { data: associations, error: assocError } = await db.client
      .from('service_monitoring_checks')
      .select(
        `
        *,
        services(id, name, status, status_page_id, status_pages(organization_id)),
        monitoring_checks(id, name, current_status, last_failure_at, consecutive_failures)
      `
      )
      .in('services.status_pages.organization_id', orgIds);

    if (assocError) {
      return NextResponse.json(
        { error: 'Failed to get associations', details: assocError.message },
        { status: 500 }
      );
    }

    console.log(
      `🔍 Found ${associations?.length || 0} service monitoring associations`
    );

    // 3. Process each association
    for (const association of associations || []) {
      try {
        const service = association.services;
        const check = association.monitoring_checks;

        if (!service || !check) {
          console.log(`⚠️ Skipping incomplete association: ${association.id}`);
          continue;
        }

        console.log(`🔍 Processing: ${service.name} <-> ${check.name}`);
        console.log(
          `   Service status: ${service.status}, Check status: ${check.current_status}`
        );

        let newServiceStatus = service.status;
        let shouldUpdate = false;

        // Determine correct service status based on check status
        if (
          check.current_status === 'down' &&
          service.status === 'operational'
        ) {
          newServiceStatus = 'down';
          shouldUpdate = true;
        } else if (
          (check.current_status === 'up' || check.current_status === 'inactive') &&
          service.status === 'down'
        ) {
          newServiceStatus = 'operational';
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          console.log(
            `🔄 Updating ${service.name}: ${service.status} → ${newServiceStatus}`
          );

          // Update service status
          const { error: updateError } = await db.client
            .from('services')
            .update({
              status: newServiceStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', service.id);

          if (updateError) {
            results.errors.push(
              `Failed to update service ${service.name}: ${updateError.message}`
            );
            continue;
          }

          results.services_updated.push({
            service_id: service.id,
            service_name: service.name,
            old_status: service.status,
            new_status: newServiceStatus,
            monitoring_check: check.name,
          });

          // Create status update post
          if (service.status_page_id) {
            try {
              const statusMessage =
                newServiceStatus === 'down'
                  ? `We are experiencing issues with ${service.name}. Our team is investigating.`
                  : `${service.name} is now operational. All systems are functioning normally.`;

              const { data: statusUpdate, error: statusError } = await db.client
                .from('status_updates')
                .insert({
                  status_page_id: service.status_page_id,
                  title: `${service.name} - ${newServiceStatus === 'down' ? 'Service Issue' : 'Service Restored'}`,
                  message: statusMessage,
                  status: newServiceStatus,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select()
                .single();

              if (statusError) {
                results.errors.push(
                  `Failed to create status update for ${service.name}: ${statusError.message}`
                );
              } else {
                results.status_updates_posted.push({
                  service_name: service.name,
                  status_update_id: statusUpdate.id,
                  title: statusUpdate.title,
                  message: statusUpdate.message,
                });
              }
            } catch (statusPostError) {
              results.errors.push(
                `Status post error for ${service.name}: ${statusPostError.message}`
              );
            }
          }
        } else {
          console.log(`✅ ${service.name} status is already correct`);
        }
      } catch (error) {
        results.errors.push(
          `Processing error for association ${association.id}: ${error.message}`
        );
      }
    }

    console.log(
      `✅ Manual sync complete. Updated ${results.services_updated.length} services`
    );

    return NextResponse.json({
      success: true,
      message: `Sync complete. Updated ${results.services_updated.length} services.`,
      results,
    });
  } catch (error) {
    console.error('🔧 Manual sync error:', error);
    return NextResponse.json(
      {
        error: 'Manual sync failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
