import { NextResponse } from 'next/server';
import { SupabaseClient, db } from '@/lib/db-supabase';
import {
  withErrorHandler,
  ApiResponse,
  Auth,
  Validator,
  parseRequestBody,
} from '@/lib/api-utils';
import { emailService } from '@/lib/email-service';

// Use the singleton instance instead of creating a new one
// const db = new SupabaseClient();

export const runtime = 'edge';

// Send incident notifications to organization members
async function sendIncidentNotifications(incident, organizationId) {
  try {
    // Get organization details
    const organization = await db.getOrganizationById(organizationId);
    if (!organization) {
      console.error('Organization not found for incident:', incident.id);
      return;
    }

    // Get organization members who should be notified
    const members =
      await db.getOrganizationMembersByOrganization(organizationId);
    const notificationTargets = members.filter(
      member =>
        ['admin', 'owner', 'responder'].includes(member.role) &&
        member.email_notifications_enabled !== false
    );

    // Create incident URL
    const incidentUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/incidents/${incident.id}`;

    // Send email to each target
    for (const member of notificationTargets) {
      try {
        await emailService.sendIncidentNotification({
          toEmail: member.users?.email || member.email,
          toName: member.users?.name || member.name,
          organizationName: organization.name,
          incidentTitle: incident.title,
          incidentDescription:
            incident.description || 'No description provided',
          severity: incident.severity,
          status: incident.status,
          incidentUrl,
          organizationBranding: {
            name: organization.name,
            logoUrl: organization.logo_url,
          },
        });

        console.log(
          `📧 Incident notification sent to ${member.users?.email || member.email}`
        );
      } catch (emailError) {
        console.error(
          `Failed to send incident notification to ${member.users?.email || member.email}:`,
          emailError
        );
      }
    }
  } catch (error) {
    console.error('Error sending incident notifications:', error);
  }
}

export const GET = withErrorHandler(async request => {
  const session = await Auth.requireAuth(request);
  const user = await Auth.requireUser(db, session.user.email);

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit')) || 25, 100);
  const offset = Math.max(parseInt(searchParams.get('offset')) || 0, 0);

  if (!organizationId) {
    return ApiResponse.badRequest('Organization ID is required');
  }

  // Validate parameters
  Validator.uuid(organizationId, 'organization_id');
  if (status) {
    Validator.enum(
      status,
      ['open', 'investigating', 'identified', 'monitoring', 'resolved'],
      'status'
    );
  }

  // Verify user has access to this organization
  await Auth.requireOrganizationMember(db, organizationId, user.id);

  const incidents = await db.getIncidentsByOrganization(organizationId);

  // Filter by status if provided
  const filteredIncidents = status
    ? incidents.filter(incident => incident.status === status)
    : incidents;

  // Apply pagination
  const paginatedIncidents = filteredIncidents.slice(offset, offset + limit);

  return ApiResponse.success({
    incidents: paginatedIncidents,
    pagination: {
      total: filteredIncidents.length,
      limit,
      offset,
      hasMore: offset + limit < filteredIncidents.length,
    },
  });
});

export const POST = withErrorHandler(async request => {
  const session = await Auth.requireAuth(request);
  const user = await Auth.requireUser(db, session.user.email);

  const {
    organizationId,
    title,
    description,
    severity = 'medium',
    status = 'investigating',
    affectedServices,
    impactDescription,
    assignedTo,
    createdBy,
    source = 'manual',
  } = await parseRequestBody(request, ['organizationId', 'title']);

  // Validate parameters
  Validator.uuid(organizationId, 'organizationId');
  Validator.enum(
    severity,
    ['critical', 'high', 'medium', 'low', 'maintenance'],
    'severity'
  );
  Validator.enum(
    status,
    ['open', 'investigating', 'identified', 'monitoring', 'resolved'],
    'status'
  );
  Validator.enum(source, ['manual', 'monitoring', 'api'], 'source');

  // Verify user has permission to create incidents in this organization
  await Auth.requireOrganizationMember(db, organizationId, user.id, [
    'owner',
    'admin',
    'responder',
  ]);

  // Sanitize HTML content
  const sanitizedTitle = Validator.sanitizeHtml(title);
  const sanitizedDescription = Validator.sanitizeHtml(description);
  const sanitizedImpactDescription = Validator.sanitizeHtml(impactDescription);

  // Create incident data object
  const incidentData = {
    organization_id: organizationId,
    title: sanitizedTitle,
    description: sanitizedDescription,
    severity,
    status,
    affected_services: affectedServices || [],
    impact_description: sanitizedImpactDescription,
    assigned_to: assignedTo,
    created_by: createdBy || user.id,
    source,
  };

  // Create the incident in the database
  const incident = await db.createIncident(incidentData);

  // Send notifications to organization members (don't wait for this to complete)
  sendIncidentNotifications(incident, organizationId).catch(error => {
    console.error('Failed to send incident notifications:', error);
  });

  return ApiResponse.success(
    { incident },
    'Incident created successfully',
    201
  );
});

export const PUT = withErrorHandler(async request => {
  const session = await Auth.requireAuth(request);
  const user = await Auth.requireUser(db, session.user.email);

  const {
    id,
    title,
    description,
    severity,
    status,
    affectedServices,
    impactDescription,
    assignedTo,
    resolvedAt,
    acknowledgedAt,
  } = await Auth.parseRequestBody(request, ['id']);

  // Validate parameters
  Validator.uuid(id, 'id');
  if (severity) {
    Validator.enum(
      severity,
      ['critical', 'high', 'medium', 'low', 'maintenance'],
      'severity'
    );
  }
  if (status) {
    Validator.enum(
      status,
      ['open', 'investigating', 'identified', 'monitoring', 'resolved'],
      'status'
    );
  }

  // Get the incident to check organization access
  const existingIncident = await db.getIncidentById(id);
  if (!existingIncident) {
    return ApiResponse.notFound('Incident');
  }

  // Verify user has permission to update incidents in this organization
  await Auth.requireOrganizationMember(
    db,
    existingIncident.organization_id,
    user.id,
    ['owner', 'admin', 'responder']
  );

  // Sanitize HTML content
  const updateData = {};
  if (title !== undefined) updateData.title = Validator.sanitizeHtml(title);
  if (description !== undefined)
    updateData.description = Validator.sanitizeHtml(description);
  if (severity !== undefined) updateData.severity = severity;
  if (status !== undefined) updateData.status = status;
  if (affectedServices !== undefined)
    updateData.affected_services = affectedServices;
  if (impactDescription !== undefined)
    updateData.impact_description = Validator.sanitizeHtml(impactDescription);
  if (assignedTo !== undefined) updateData.assigned_to = assignedTo;

  // Add timestamp fields if provided
  if (resolvedAt !== undefined) updateData.resolved_at = resolvedAt;
  if (acknowledgedAt !== undefined) updateData.acknowledged_at = acknowledgedAt;

  // Update the incident in the database
  const incident = await db.updateIncident(id, updateData);

  return ApiResponse.success({ incident }, 'Incident updated successfully');
});

export const DELETE = withErrorHandler(async request => {
  const session = await Auth.requireAuth(request);
  const user = await Auth.requireUser(db, session.user.email);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiResponse.badRequest('Incident ID is required');
  }

  // Validate parameter
  Validator.uuid(id, 'id');

  // Get the incident to check organization access
  const existingIncident = await db.getIncidentById(id);
  if (!existingIncident) {
    return ApiResponse.notFound('Incident');
  }

  // Verify user has permission to delete incidents in this organization
  await Auth.requireOrganizationMember(
    db,
    existingIncident.organization_id,
    user.id,
    ['owner', 'admin']
  );

  // Delete the incident from the database
  await db.deleteIncident(id);

  return ApiResponse.success({}, 'Incident deleted successfully');
});
