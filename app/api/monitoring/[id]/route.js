import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: checkId } = params;

    if (!checkId) {
      return NextResponse.json(
        { error: 'Monitoring check ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get monitoring check
    const check = await db.getMonitoringCheckById(checkId);
    if (!check) {
      return NextResponse.json(
        { error: 'Monitoring check not found' },
        { status: 404 }
      );
    }

    // Check organization membership
    const membership = await db.getOrganizationMember(
      check.organization_id,
      user.id
    );
    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      check,
    });
  } catch (error) {
    console.error('Error fetching monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: checkId } = params;
    const body = await req.json();

    if (!checkId) {
      return NextResponse.json(
        { error: 'Monitoring check ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate that user has access to this monitoring check
    const existingCheck = await db.getMonitoringCheckById(checkId);
    if (!existingCheck) {
      return NextResponse.json(
        { error: 'Monitoring check not found' },
        { status: 404 }
      );
    }

    // Check organization membership
    const membership = await db.getOrganizationMember(
      existingCheck.organization_id,
      user.id
    );
    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if we're disabling the check (status change to disabled/paused)
    const isBeingDisabled =
      body.status &&
      ['disabled', 'paused', 'inactive'].includes(body.status) &&
      existingCheck.status === 'active';

    // Update monitoring check
    const updatedCheck = await db.updateMonitoringCheck(checkId, body);

    // Handle service recovery if check is being disabled
    if (isBeingDisabled) {
      console.log(
        `🔄 Check "${existingCheck.name}" disabled, checking for service recovery...`
      );
      await handleServiceRecoveryForDisabledCheck(
        checkId,
        existingCheck,
        user.id
      );
    }

    return NextResponse.json({
      success: true,
      monitoring_check: updatedCheck,
      message: 'Monitoring check updated successfully',
    });
  } catch (error) {
    console.error('Error updating monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Handle automatic service recovery when a monitoring check is disabled
async function handleServiceRecoveryForDisabledCheck(
  checkId,
  monitoringCheck,
  userId
) {
  try {
    // Find all services associated with this monitoring check
    const { data: associations, error: associationError } = await db.client
      .from('service_monitoring_checks')
      .select('service_id, failure_message')
      .eq('monitoring_check_id', checkId);

    if (associationError) {
      console.error(
        'Error fetching service associations for recovery:',
        associationError
      );
      return;
    }

    if (!associations || associations.length === 0) {
      console.log('No service associations found for disabled check');
      return;
    }

    console.log(
      `Found ${associations.length} service(s) associated with disabled check`
    );

    // Process each associated service
    for (const association of associations) {
      const serviceId = association.service_id;

      // Get the service details
      const { data: service, error: serviceError } = await db.client
        .from('services')
        .select('*, status_pages(id)')
        .eq('id', serviceId)
        .single();

      if (serviceError || !service) {
        console.warn(`Service ${serviceId} not found during recovery`);
        continue;
      }

      // Only process if service is currently degraded or down
      if (!['degraded', 'down', 'maintenance'].includes(service.status)) {
        console.log(
          `Service ${service.name} is already operational, skipping recovery`
        );
        continue;
      }

      // Check if there are any other ACTIVE monitoring checks that might be affecting this service
      const { data: otherFailingChecks, error: checksError } = await db.client
        .from('service_monitoring_checks')
        .select(
          `
          monitoring_checks!inner(
            id, 
            name, 
            status, 
            current_status
          )
        `
        )
        .eq('service_id', serviceId)
        .neq('monitoring_check_id', checkId) // Exclude the check we just disabled
        .eq('monitoring_checks.status', 'active'); // Only active checks

      if (checksError) {
        console.error('Error checking other monitoring checks:', checksError);
        continue;
      }

      // Count how many active checks are currently failing for this service
      const activeFailingChecks = (otherFailingChecks || []).filter(
        assoc => assoc.monitoring_checks?.current_status === 'down'
      );

      console.log(
        `Service ${service.name}: ${activeFailingChecks.length} other active failing checks`
      );

      // If no other active checks are failing, recover the service
      if (activeFailingChecks.length === 0) {
        console.log(
          `🔄 Recovering service ${service.name} to operational status`
        );

        // Update service status to operational
        const { error: updateError } = await db.client
          .from('services')
          .update({
            status: 'operational',
            updated_at: new Date().toISOString(),
          })
          .eq('id', serviceId);

        if (updateError) {
          console.error(
            `Error updating service ${service.name} status:`,
            updateError
          );
          continue;
        }

        // Create a recovery status update
        if (service.status_pages?.id) {
          const recoveryMessage = association.failure_message?.trim()
            ? `${service.name} has been restored to normal operation.`
            : `${service.name} monitoring has been disabled and the service is now marked as operational.`;

          const { error: statusUpdateError } = await db.client
            .from('status_updates')
            .insert({
              status_page_id: service.status_pages.id,
              title: `${service.name} Restored`,
              message: recoveryMessage,
              status: 'operational',
              update_type: 'monitoring',
              created_by: userId,
            });

          if (statusUpdateError) {
            console.error(
              'Error creating recovery status update:',
              statusUpdateError
            );
          } else {
            console.log(
              `✅ Created recovery status update for ${service.name}`
            );
          }
        }

        console.log(`✅ Successfully recovered service ${service.name}`);
      } else {
        console.log(
          `Service ${service.name} still has ${activeFailingChecks.length} other failing checks, not recovering`
        );
      }
    }
  } catch (error) {
    console.error('Error handling service recovery for disabled check:', error);
  }
}

export async function DELETE(req, { params }) {
  console.log('🗑️ DELETE API called with params:', params);

  try {
    const session = await auth();
    console.log('👤 Session check:', session?.user?.email || 'No session');

    if (!session || !session.user?.email) {
      console.log('❌ Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: checkId } = params;
    console.log('🆔 Check ID:', checkId);

    if (!checkId) {
      console.log('❌ No check ID provided');
      return NextResponse.json(
        { error: 'Monitoring check ID is required' },
        { status: 400 }
      );
    }

    // Get user
    console.log('👤 Getting user by email:', session.user.email);
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      console.log('❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.log('✅ User found:', user.id);

    // Validate that user has access to this monitoring check
    console.log('🔍 Getting monitoring check by ID:', checkId);
    const existingCheck = await db.getMonitoringCheckById(checkId);
    if (!existingCheck) {
      console.log('❌ Monitoring check not found');
      return NextResponse.json(
        { error: 'Monitoring check not found' },
        { status: 404 }
      );
    }
    console.log(
      '✅ Monitoring check found:',
      existingCheck.name,
      'Org:',
      existingCheck.organization_id
    );

    // Check organization membership
    console.log(
      '🏢 Checking organization membership for org:',
      existingCheck.organization_id,
      'user:',
      user.id
    );
    const membership = await db.getOrganizationMember(
      existingCheck.organization_id,
      user.id
    );
    console.log('👥 Membership:', membership?.role || 'None');

    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      console.log('❌ Access denied - insufficient permissions');
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Delete monitoring check
    console.log('🗑️ Deleting monitoring check:', checkId);
    const deleteResult = await db.deleteMonitoringCheck(checkId);
    console.log('✅ Delete result:', deleteResult);

    console.log('✅ Delete operation completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Monitoring check deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting monitoring check:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
