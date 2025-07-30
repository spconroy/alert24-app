import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import {
  withErrorHandler,
  ApiResponse,
  Auth,
  Validator,
  parseRequestBody,
} from '@/lib/api-utils';

const db = new SupabaseClient();

export const runtime = 'edge';

// Helper function to safely extract monitoring check data
// Handles both old JSON format and new direct database fields
function getCheckData(check) {
  // If data is available directly from database columns (new format)
  if (check.check_type) {
    return {
      check_type: check.check_type,
      target_url: check.target_url,
      organization_id: check.organization_id,
      linked_service_id: check.linked_service_id,
      name: check.name,
      url: check.target_url,
      ...check,
    };
  }

  // Fall back to parsing JSON from description field (old format)
  try {
    if (check.description && typeof check.description === 'string') {
      const parsed = JSON.parse(check.description);
      return parsed;
    } else if (
      check.monitoring_data &&
      typeof check.monitoring_data === 'string'
    ) {
      const parsed = JSON.parse(check.monitoring_data);
      return parsed;
    }
    return check.description || check.monitoring_data || {};
  } catch (e) {
    console.warn('Failed to parse check data as JSON:', e);
    return {};
  }
}

// GET - Get associations for monitoring checks
export const GET = withErrorHandler(async request => {
  const sessionManager = new SessionManager();
  const session = await sessionManager.getSessionFromRequest(request);
  const user = await Auth.requireUser(db, session.user.email);

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');
  const monitoringCheckId = searchParams.get('monitoring_check_id');
  const serviceId = searchParams.get('service_id');

  if (!organizationId) {
    return ApiResponse.badRequest('Organization ID is required');
  }

  Validator.uuid(organizationId, 'organization_id');
  await Auth.requireOrganizationMember(db, organizationId, user.id);

  try {
    // Get monitoring checks for the organization
    const monitoringChecks = await db.getMonitoringChecks(user.id, {
      organization_id: organizationId,
    });

    // Get services for the organization
    const { data: services, error } = await db.client
      .from('services')
      .select(
        `
        *,
        status_pages!inner(organization_id)
      `
      )
      .eq('status_pages.organization_id', organizationId)
      .not('name', 'ilike', '[[]MONITORING]%')
      .is('deleted_at', null)
      .order('name');

    if (error) throw error;

    // Build associations array
    const associations = [];

    for (const check of monitoringChecks) {
      const checkData = getCheckData(check);
      const linkedServiceId = checkData.linked_service_id;

      associations.push({
        monitoring_check_id: check.id,
        monitoring_check_name: check.name,
        check_type: check.check_type,
        target_url: check.target_url,
        status: check.status,
        linked_service_id: linkedServiceId,
        linked_service_name: linkedServiceId
          ? services.find(s => s.id === linkedServiceId)?.name ||
            'Unknown Service'
          : null,
      });
    }

    // Filter by specific check or service if requested
    let filteredAssociations = associations;
    if (monitoringCheckId) {
      Validator.uuid(monitoringCheckId, 'monitoring_check_id');
      filteredAssociations = associations.filter(
        a => a.monitoring_check_id === monitoringCheckId
      );
    }
    if (serviceId) {
      Validator.uuid(serviceId, 'service_id');
      filteredAssociations = associations.filter(
        a => a.linked_service_id === serviceId
      );
    }

    return ApiResponse.success({
      associations: filteredAssociations,
      available_services: services || [],
    });
  } catch (error) {
    console.error('Error fetching monitoring associations:', error);
    throw error;
  }
});

// POST - Create or update association between monitoring check and service
export const POST = withErrorHandler(async request => {
  const sessionManager = new SessionManager();
  const session = await sessionManager.getSessionFromRequest(request);
  const user = await Auth.requireUser(db, session.user.email);

  const { monitoringCheckId, serviceId, failureStatus, organizationId } =
    await parseRequestBody(request, ['monitoringCheckId', 'organizationId']);

  // Validate parameters
  Validator.uuid(monitoringCheckId, 'monitoringCheckId');
  Validator.uuid(organizationId, 'organizationId');
  if (serviceId) {
    Validator.uuid(serviceId, 'serviceId');
  }

  // Verify user has permission to manage associations in this organization
  await Auth.requireOrganizationMember(db, organizationId, user.id, [
    'owner',
    'admin',
    'responder',
  ]);

  try {
    // Get the monitoring check and verify it exists and belongs to the organization
    const monitoringCheck = await db.getMonitoringCheckById(monitoringCheckId);
    if (!monitoringCheck) {
      return ApiResponse.notFound('Monitoring check');
    }

    if (monitoringCheck.organization_id !== organizationId) {
      return ApiResponse.forbidden(
        'Monitoring check does not belong to this organization'
      );
    }

    // If serviceId is provided, verify the service exists and belongs to the organization
    if (serviceId) {
      const service = await db.getServiceById(serviceId);
      if (!service) {
        return ApiResponse.notFound('Service');
      }

      if (service.status_pages?.organization_id !== organizationId) {
        return ApiResponse.forbidden(
          'Service does not belong to this organization'
        );
      }
    }

    if (serviceId) {
      // Create association in the junction table
      const associationData = {
        service_id: serviceId,
        monitoring_check_id: monitoringCheckId,
        failure_status: failureStatus || 'degraded',
        failure_threshold_minutes: 5,
        failure_message: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Remove any existing association first
      await db.client
        .from('service_monitoring_checks')
        .delete()
        .eq('monitoring_check_id', monitoringCheckId);

      // Insert new association
      const { error: insertError } = await db.client
        .from('service_monitoring_checks')
        .insert(associationData);

      if (insertError) throw insertError;

      // Also update the linked_service_id in the monitoring check itself
      const { error: updateError } = await db.client
        .from('monitoring_checks')
        .update({ 
          linked_service_id: serviceId,
          updated_at: new Date().toISOString()
        })
        .eq('id', monitoringCheckId)
        .eq('organization_id', organizationId);

      if (updateError) throw updateError;
    } else {
      // Remove association
      const { error: deleteError } = await db.client
        .from('service_monitoring_checks')
        .delete()
        .eq('monitoring_check_id', monitoringCheckId);

      if (deleteError) throw deleteError;

      // Also clear the linked_service_id from the monitoring check itself
      const { error: updateError } = await db.client
        .from('monitoring_checks')
        .update({ 
          linked_service_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', monitoringCheckId)
        .eq('organization_id', organizationId);

      if (updateError) throw updateError;
    }

    const associationAction = serviceId
      ? 'associated with'
      : 'dissociated from';
    const serviceName = serviceId
      ? (await db.getServiceById(serviceId))?.name || 'Unknown Service'
      : 'any service';

    return ApiResponse.success(
      {
        monitoring_check_id: monitoringCheckId,
        service_id: serviceId,
        service_name: serviceName,
      },
      `Monitoring check ${associationAction} ${serviceName}`
    );
  } catch (error) {
    console.error('Error creating monitoring association:', error);
    throw error;
  }
});

// DELETE - Remove association between monitoring check and service
export const DELETE = withErrorHandler(async request => {
  const sessionManager = new SessionManager();
  const session = await sessionManager.getSessionFromRequest(request);
  const user = await Auth.requireUser(db, session.user.email);

  const { searchParams } = new URL(request.url);
  const monitoringCheckId = searchParams.get('monitoring_check_id');
  const organizationId = searchParams.get('organization_id');

  if (!monitoringCheckId || !organizationId) {
    return ApiResponse.badRequest(
      'Monitoring check ID and organization ID are required'
    );
  }

  Validator.uuid(monitoringCheckId, 'monitoring_check_id');
  Validator.uuid(organizationId, 'organization_id');

  // Verify user has permission to manage associations in this organization
  await Auth.requireOrganizationMember(db, organizationId, user.id, [
    'owner',
    'admin',
    'responder',
  ]);

  try {
    console.log(`Removing association for monitoring check ${monitoringCheckId}`);
    
    // Remove association from junction table
    const { error: deleteError } = await db.client
      .from('service_monitoring_checks')
      .delete()
      .eq('monitoring_check_id', monitoringCheckId);

    if (deleteError) {
      console.error('Error deleting from service_monitoring_checks:', deleteError);
      throw deleteError;
    }

    // Also clear the linked_service_id from the monitoring check itself
    const { error: updateError } = await db.client
      .from('monitoring_checks')
      .update({ 
        linked_service_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', monitoringCheckId)
      .eq('organization_id', organizationId);

    if (updateError) {
      console.error('Error updating monitoring_checks:', updateError);
      throw updateError;
    }

    console.log(`Successfully removed association for monitoring check ${monitoringCheckId}`);

    return ApiResponse.success(
      { monitoring_check_id: monitoringCheckId },
      'Association removed successfully'
    );
  } catch (error) {
    console.error('Error removing monitoring association:', error);
    throw error;
  }
});
