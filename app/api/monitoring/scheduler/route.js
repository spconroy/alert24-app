import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import { emailService } from '@/lib/email-service';

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
      ...check
    };
  }
  
  // Fall back to parsing JSON from description field (old format)
  try {
    if (check.description && typeof check.description === 'string') {
      const parsed = JSON.parse(check.description);
      return parsed;
    }
    return check.description || {};
  } catch (e) {
    console.warn('Failed to parse check description as JSON:', e);
    return {};
  }
}

// Update the status of a service linked to this monitoring check
async function updateLinkedServiceStatus(check, result) {
  try {
    // Get check data using helper function
    const checkData = getCheckData(check);
    const linkedServiceId = checkData.linked_service_id;

    if (!linkedServiceId) {
      return; // No linked service
    }

    // Get the linked service
    const { data: linkedService, error: fetchError } = await db.client
      .from('services')
      .select('*')
      .eq('id', linkedServiceId)
      .not('name', 'ilike', '[[]MONITORING]%')
      .single();

    if (fetchError || !linkedService) {
      console.warn(
        `Linked service ${linkedServiceId} not found or not accessible`
      );
      return;
    }

    // Determine new service status based on monitoring result
    let newStatus = 'operational';
    if (!result.is_successful) {
      // Determine severity based on error type
      if (result.status_code >= 500) {
        newStatus = 'down';
      } else if (result.status_code >= 400 || result.response_time_ms > 10000) {
        newStatus = 'degraded';
      } else {
        newStatus = 'degraded'; // Default for any failure
      }
    }

    // Only update if status actually changed
    if (linkedService.status !== newStatus) {
      const { error: updateError } = await db.client
        .from('services')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkedServiceId);

      if (updateError) {
        console.error('Error updating linked service status:', updateError);
      } else {
        console.log(
          `🔗 Updated linked service ${linkedService.name}: ${linkedService.status} → ${newStatus}`
        );
        return {
          oldStatus: linkedService.status,
          newStatus,
          serviceName: linkedService.name,
        };
      }
    }
  } catch (error) {
    console.error('Error updating linked service status:', error);
  }
  return null;
}

// Resolve incident when monitoring check recovers
async function resolveIncidentForRecovery(check) {
  try {
    // Get check data using helper function
    const checkData = getCheckData(check);

    // Find open monitoring-related incidents for this check
    const existingIncidents = await db.getIncidentsByOrganization(
      checkData.organization_id
    );
    const openIncident = existingIncidents.find(
      incident =>
        incident.source === 'monitoring' &&
        incident.status !== 'resolved' &&
        incident.affected_services?.includes(check.id)
    );

    if (openIncident) {
      // Auto-resolve the incident
      const updateData = {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      };

      await db.updateIncident(openIncident.id, updateData);
      console.log(
        `✅ Auto-resolved incident ${openIncident.id} - check ${check.name} recovered`
      );
      return openIncident;
    }
  } catch (error) {
    console.error('Error resolving incident for recovery:', error);
  }
  return null;
}

// Create incident for monitoring check failure
async function createIncidentForFailure(check, result) {
  try {
    // Get check data using helper function
    const checkData = getCheckData(check);

    // Get organization details
    const organization = await db.getOrganizationById(
      checkData.organization_id
    );
    if (!organization) {
      console.error('Organization not found for check:', check.id);
      return null;
    }

    // Check if there's already an open incident for this check
    const existingIncidents = await db.getIncidentsByOrganization(
      checkData.organization_id
    );
    const openIncident = existingIncidents.find(
      incident =>
        incident.source === 'monitoring' &&
        incident.status !== 'resolved' &&
        incident.affected_services?.includes(check.id)
    );

    if (openIncident) {
      console.log(
        `Incident already exists for check ${check.name}: ${openIncident.id}`
      );
      return openIncident;
    }

    // Determine severity based on check type and failure details
    let severity = 'medium';
    if (checkData.check_type === 'http' && result.status_code >= 500) {
      severity = 'high';
    } else if (result.response_time_ms > 10000) {
      severity = 'high';
    } else if (
      checkData.check_type === 'ssl' &&
      result.error_message?.includes('expired')
    ) {
      severity = 'critical';
    }

    // Create incident
    const incidentData = {
      organization_id: checkData.organization_id,
      title: `Service Down: ${check.name}`,
      description: `Monitoring check "${checkData.name || check.name}" has failed.\n\nError: ${result.error_message}\n\nCheck URL: ${checkData.url || checkData.target_url}\nResponse Time: ${result.response_time_ms}ms\n${result.status_code ? `Status Code: ${result.status_code}` : ''}`,
      severity,
      status: 'investigating',
      affected_services: [check.id],
      impact_description: `Service "${check.name}" is currently unavailable or experiencing issues.`,
      source: 'monitoring',
      created_by: null, // System created
    };

    const incident = await db.createIncident(incidentData);
    console.log(
      `📋 Auto-created incident ${incident.id} for failed check: ${check.name}`
    );
    return incident;
  } catch (error) {
    console.error('Error creating incident for failure:', error);
    return null;
  }
}

// Send failure notifications for monitoring checks
async function sendFailureNotifications(check, result) {
  try {
    // Get check data using helper function
    const checkData = getCheckData(check);

    // Get organization details
    const organization = await db.getOrganizationById(
      checkData.organization_id
    );
    if (!organization) {
      console.error('Organization not found for check:', check.id);
      return;
    }

    // Get organization members who should be notified (admins and responders)
    const members = await db.getOrganizationMembersByOrganization(
      checkData.organization_id
    );
    const notificationTargets = members.filter(
      member =>
        ['admin', 'owner', 'responder'].includes(member.role) &&
        member.email_notifications_enabled !== false
    );

    // Send email to each target
    for (const member of notificationTargets) {
      try {
        await emailService.sendMonitoringAlert({
          toEmail: member.users?.email || member.email,
          toName: member.users?.name || member.name,
          organizationName: organization.name,
          serviceName: check.name,
          checkName: checkData.name || check.name,
          alertType: 'down',
          errorMessage: result.error_message,
          responseTime: result.response_time_ms,
          organizationBranding: {
            name: organization.name,
            logoUrl: organization.logo_url,
          },
        });

        console.log(
          `📧 Failure notification sent to ${member.users?.email || member.email}`
        );
      } catch (emailError) {
        console.error(
          `Failed to send notification to ${member.users?.email || member.email}:`,
          emailError
        );
      }
    }
  } catch (error) {
    console.error('Error sending failure notifications:', error);
  }
}

export async function GET(req) {
  // Verify this is coming from Vercel Cron or internal call
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const executionResults = [];

    // Get all active monitoring checks
    const pendingChecks = await db.getPendingMonitoringChecks(50);

    console.log(`Found ${pendingChecks.length} pending monitoring checks`);

    // For each check, determine if it needs to run based on last check time
    for (const check of pendingChecks) {
      try {
        // Get the most recent check result
        const recentResults = await db.getCheckResults(check.id, 1);
        const lastResult = recentResults[0];

        // Calculate if check should run
        let shouldRun = false;
        if (!lastResult) {
          // Never been checked
          shouldRun = true;
        } else {
          const lastCheckTime = new Date(lastResult.created_at);
          const intervalMinutes = check.check_interval_minutes || 5;
          const nextCheckTime = new Date(
            lastCheckTime.getTime() + intervalMinutes * 60000
          );
          shouldRun = new Date() >= nextCheckTime;
        }

        if (shouldRun) {
          console.log(`Executing check: ${check.name} (${check.id})`);

          // Execute the monitoring check
          const result = await executeMonitoringCheck(check);

          // Store the result
          const checkResult = await db.createCheckResult({
            monitoring_check_id: check.id,
            is_successful: result.is_successful,
            response_time: result.response_time,
            status_code: result.status_code,
            error_message: result.error_message,
            response_body: result.response_body,
          });

          // Update linked service status if association exists
          const linkedServiceUpdate = await updateLinkedServiceStatus(
            check,
            result
          );

          executionResults.push({
            check_id: check.id,
            check_name: check.name,
            success: result.is_successful,
            response_time: result.response_time,
            error: result.error_message,
            linked_service_updated: linkedServiceUpdate
              ? {
                  service_name: linkedServiceUpdate.serviceName,
                  old_status: linkedServiceUpdate.oldStatus,
                  new_status: linkedServiceUpdate.newStatus,
                }
              : null,
          });

          // If check failed, create incident and trigger notifications
          if (!result.is_successful) {
            console.log(
              `Check failed: ${check.name} - ${result.error_message}`
            );

            // Create incident for the failure (if one doesn't already exist)
            const incident = await createIncidentForFailure(check, result);

            // Send email notifications to organization admins and responders
            await sendFailureNotifications(check, result);

            // Add incident info to execution results
            if (incident) {
              executionResults[executionResults.length - 1].incident_created =
                incident.id;
            }
          } else {
            // Check succeeded - resolve any open incidents for this check
            const resolvedIncident = await resolveIncidentForRecovery(check);
            if (resolvedIncident) {
              executionResults[executionResults.length - 1].incident_resolved =
                resolvedIncident.id;
              console.log(`✅ Check recovered: ${check.name}`);
            }
          }
        } else {
          console.log(`Skipping check: ${check.name} (not due yet)`);
        }
      } catch (error) {
        console.error(`Error executing check ${check.id}:`, error);
        executionResults.push({
          check_id: check.id,
          check_name: check.name,
          success: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${pendingChecks.length} monitoring checks`,
      results: executionResults,
      execution_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Monitoring scheduler error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute monitoring scheduler',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper function to execute monitoring checks
async function executeMonitoringCheck(check) {
  const startTime = Date.now();

  try {
    if (check.check_type === 'http' || check.check_type === 'https') {
      return await executeHttpCheck(check);
    } else if (check.check_type === 'ping') {
      return await executePingCheck(check);
    } else if (check.check_type === 'tcp') {
      return await executeTcpCheck(check);
    } else if (check.check_type === 'ssl') {
      return await executeSslCheck(check);
    } else {
      throw new Error(`Unsupported check type: ${check.check_type}`);
    }
  } catch (error) {
    return {
      is_successful: false,
      response_time: Date.now() - startTime,
      status_code: null,
      error_message: error.message,
      response_body: null,
    };
  }
}

async function executeHttpCheck(check) {
  const { target_url, timeout_seconds, expected_response_code } = check;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (timeout_seconds || 30) * 1000
    );

    const response = await fetch(target_url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Alert24-Monitor/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    const isSuccessful = statusCode === (expected_response_code || 200);

    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch (e) {
      // Ignore body read errors
    }

    return {
      is_successful: isSuccessful,
      response_time: responseTime,
      status_code: statusCode,
      error_message: isSuccessful ? null : `HTTP ${statusCode}`,
      response_body: responseBody.substring(0, 1000), // Limit body size
    };
  } catch (error) {
    return {
      is_successful: false,
      response_time: Date.now() - startTime,
      status_code: null,
      error_message: error.message,
      response_body: null,
    };
  }
}

async function executePingCheck(check) {
  // Simplified ping check - in a real implementation you'd use a proper ping library
  const { target_url, timeout_seconds } = check;
  const startTime = Date.now();

  try {
    // Use target_url directly as hostname/IP since it's no longer a URL for ping checks
    let hostname = target_url;

    // If it looks like a URL, extract the hostname (for backward compatibility)
    if (target_url.includes('://')) {
      hostname = new URL(target_url).hostname;
    }

    // Use a simple TCP connection test as a ping alternative (port 80 for basic connectivity)
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (timeout_seconds || 30) * 1000
    );

    // Try to connect to port 80 (HTTP) as a basic connectivity test
    const response = await fetch(`http://${hostname}`, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      is_successful: true,
      response_time: Date.now() - startTime,
      status_code: response.status,
      error_message: null,
      response_body: null,
    };
  } catch (error) {
    return {
      is_successful: false,
      response_time: Date.now() - startTime,
      status_code: null,
      error_message: error.message,
      response_body: null,
    };
  }
}

// TCP Check execution
async function executeTcpCheck(check) {
  const { target_url, timeout_seconds } = check;
  const startTime = Date.now();

  try {
    // Parse hostname:port from target_url
    const targetParts = target_url.split(':');
    if (targetParts.length !== 2) {
      return {
        is_successful: false,
        response_time: Date.now() - startTime,
        status_code: null,
        error_message: 'TCP check requires hostname:port format',
        response_body: null,
      };
    }

    const hostname = targetParts[0];
    const port = parseInt(targetParts[1]);

    // Use HTTP request to test TCP connectivity
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (timeout_seconds || 30) * 1000
    );

    const response = await fetch(`http://${hostname}:${port}`, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      is_successful: true,
      response_time: Date.now() - startTime,
      status_code: response.status,
      error_message: null,
      response_body: null,
    };
  } catch (error) {
    return {
      is_successful: false,
      response_time: Date.now() - startTime,
      status_code: null,
      error_message: `TCP connection failed - ${error.message}`,
      response_body: null,
    };
  }
}

// SSL Check execution
async function executeSslCheck(check) {
  const { target_url, timeout_seconds } = check;
  const startTime = Date.now();

  try {
    // Ensure we have an HTTPS URL
    let httpsUrl = target_url;
    if (!httpsUrl.startsWith('https://')) {
      httpsUrl = `https://${target_url}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (timeout_seconds || 30) * 1000
    );

    const response = await fetch(httpsUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      is_successful: response.status < 500, // Any response means SSL is working
      response_time: Date.now() - startTime,
      status_code: response.status,
      error_message:
        response.status < 500
          ? null
          : `SSL check failed with status ${response.status}`,
      response_body: null,
    };
  } catch (error) {
    return {
      is_successful: false,
      response_time: Date.now() - startTime,
      status_code: null,
      error_message: `SSL check failed - ${error.message}`,
      response_body: null,
    };
  }
}
