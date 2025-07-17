import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import { authOptions } from '../../auth/[...nextauth]/route.js';
import {
  withErrorHandler,
  ApiResponse,
  Auth,
  Validator,
  parseRequestBody,
} from '../../../../lib/api-utils.js';

const db = new SupabaseClient();

export const runtime = 'edge';

// GET - Get associations for monitoring checks
export const GET = withErrorHandler(async request => {
  const session = await Auth.requireAuth(authOptions);
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
      const checkData = JSON.parse(
        check.description || check.monitoring_data || '{}'
      );
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
  const session = await Auth.requireAuth(authOptions);
  const user = await Auth.requireUser(db, session.user.email);

  const { monitoringCheckId, serviceId, organizationId } =
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

    // Get current monitoring check data from services table
    const { data: currentService, error: fetchError } = await db.client
      .from('services')
      .select('*')
      .eq('id', monitoringCheckId)
      .ilike('name', '[[]MONITORING]%')
      .single();

    if (fetchError) throw fetchError;

    // Parse and update the stored monitoring data
    const checkData = JSON.parse(currentService.description);
    checkData.linked_service_id = serviceId; // null to remove association

    const dbData = {
      description: JSON.stringify(checkData),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await db.client
      .from('services')
      .update(dbData)
      .eq('id', monitoringCheckId);

    if (updateError) throw updateError;

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
  const session = await Auth.requireAuth(authOptions);
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
    // Remove association by setting linked_service_id to null
    const { data: currentService, error: fetchError } = await db.client
      .from('services')
      .select('*')
      .eq('id', monitoringCheckId)
      .ilike('name', '[[]MONITORING]%')
      .single();

    if (fetchError) throw fetchError;

    const checkData = JSON.parse(currentService.description);
    delete checkData.linked_service_id; // Remove the association

    const dbData = {
      description: JSON.stringify(checkData),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await db.client
      .from('services')
      .update(dbData)
      .eq('id', monitoringCheckId);

    if (updateError) throw updateError;

    return ApiResponse.success(
      { monitoring_check_id: monitoringCheckId },
      'Association removed successfully'
    );
  } catch (error) {
    console.error('Error removing monitoring association:', error);
    throw error;
  }
});
