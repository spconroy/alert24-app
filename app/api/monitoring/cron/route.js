import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

// Simple cron endpoint that doesn't require external authentication
// This can be called by browser, or set up with a simple cron service

export async function GET(req) {
  try {
    console.log('🕐 Starting monitoring cron job...');

    // Get all active monitoring checks that need to be executed
    const { data: checks, error } = await db.client
      .from('monitoring_checks')
      .select('*')
      .eq('status', 'active')
      .order('last_check_at', { ascending: true });

    if (error) {
      console.error('Error fetching monitoring checks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Found ${checks.length} active monitoring checks`);

    const results = [];
    const now = new Date();

    for (const check of checks) {
      try {
        // Determine if this check should run
        let shouldRun = false;

        if (!check.last_check_at) {
          // Never been checked
          shouldRun = true;
        } else {
          const lastCheck = new Date(check.last_check_at);
          const intervalMs = (check.check_interval_seconds || 300) * 1000;
          const nextCheckDue = new Date(lastCheck.getTime() + intervalMs);

          shouldRun = now >= nextCheckDue;
        }

        if (shouldRun) {
          console.log(`⚡ Executing check: ${check.name}`);

          // Execute the check directly using the same logic as the execute endpoint
          const executeResult = await executeMonitoringCheckDirect(check);

          // Update the monitoring check status
          await updateMonitoringCheckStatus(check.id, executeResult);

          results.push({
            checkId: check.id,
            checkName: check.name,
            status: 'executed',
            result: {
              success: executeResult.is_successful,
              responseTime: executeResult.response_time_ms,
              statusCode: executeResult.status_code,
              error: executeResult.error_message,
            },
          });
        } else {
          const lastCheck = check.last_check_at
            ? new Date(check.last_check_at)
            : null;
          const nextDue = lastCheck
            ? new Date(
                lastCheck.getTime() +
                  (check.check_interval_seconds || 300) * 1000
              )
            : 'Never checked';

          console.log(
            `⏳ Skipping check: ${check.name} (next due: ${nextDue})`
          );
          results.push({
            checkId: check.id,
            checkName: check.name,
            status: 'skipped',
            nextDue: nextDue,
          });
        }
      } catch (error) {
        console.error(`Error processing check ${check.id}:`, error);
        results.push({
          checkId: check.id,
          checkName: check.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    const executed = results.filter(r => r.status === 'executed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(
      `✅ Cron completed: ${executed} executed, ${skipped} skipped, ${errors} errors`
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalChecks: checks.length,
        executed,
        skipped,
        errors,
      },
      results,
      executedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Monitoring cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Cron execution failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Execute a single monitoring check
async function executeMonitoringCheckDirect(check) {
  const startTime = Date.now();
  let result = {
    check_id: check.id,
    timestamp: new Date().toISOString(),
    is_successful: false,
    response_time_ms: null,
    status_code: null,
    error_message: null,
    ssl_info: null,
  };

  try {
    console.log(
      `Executing ${check.check_type} check: ${check.name} -> ${check.target_url}`
    );

    // Handle different check types
    if (check.check_type === 'http') {
      return await executeHttpCheck(check, result, startTime);
    } else if (check.check_type === 'ping') {
      return await executePingCheck(check, result, startTime);
    } else if (check.check_type === 'tcp') {
      return await executeTcpCheck(check, result, startTime);
    } else if (check.check_type === 'ssl') {
      return await executeSslCheck(check, result, startTime);
    } else {
      result.error_message = `Unsupported check type: ${check.check_type}`;
      result.response_time_ms = Date.now() - startTime;
      return result;
    }
  } catch (error) {
    result.response_time_ms = Date.now() - startTime;
    result.is_successful = false;

    if (error.name === 'AbortError') {
      result.error_message = `Timeout after ${check.timeout_seconds || 30} seconds`;
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      result.error_message = `DNS resolution failed or connection refused: ${error.message}`;
    } else {
      result.error_message = error.message || 'Unknown error';
    }

    console.log(`Check failed: ${check.name} - ${result.error_message}`);
  }

  return result;
}

// HTTP Check execution
async function executeHttpCheck(check, result, startTime) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    (check.timeout_seconds || 30) * 1000
  );

  const fetchOptions = {
    method: check.method || 'GET',
    signal: controller.signal,
    redirect: 'follow',
    headers: {
      'User-Agent': 'Alert24-Monitor/1.0',
      ...check.headers,
    },
  };

  const response = await fetch(check.target_url, fetchOptions);
  clearTimeout(timeoutId);

  const responseTime = Date.now() - startTime;
  result.response_time_ms = responseTime;
  result.status_code = response.status;

  // Check if status code is expected
  const expectedCodes = [check.expected_status_code] || [200];
  const statusCodeOk = expectedCodes.includes(response.status);

  result.is_successful = statusCodeOk;

  if (!result.is_successful && !result.error_message) {
    result.error_message = `Status ${response.status} not in expected codes ${expectedCodes.join(',')}`;
  }

  return result;
}

// Ping Check execution
async function executePingCheck(check, result, startTime) {
  let hostname = check.target_url;

  // If it looks like a URL, extract the hostname
  if (check.target_url.includes('://')) {
    hostname = new URL(check.target_url).hostname;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    (check.timeout_seconds || 30) * 1000
  );

  try {
    // Try to connect to port 80 (HTTP) as a basic connectivity test
    const response = await fetch(`http://${hostname}`, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    result.response_time_ms = Date.now() - startTime;
    result.status_code = response.status;
    result.is_successful = true;
    result.error_message = null;
  } catch (error) {
    clearTimeout(timeout);
    result.response_time_ms = Date.now() - startTime;
    result.is_successful = false;
    result.error_message = error.message;
  }

  return result;
}

// TCP Check execution
async function executeTcpCheck(check, result, startTime) {
  const targetParts = check.target_url.split(':');
  if (targetParts.length !== 2) {
    result.response_time_ms = Date.now() - startTime;
    result.is_successful = false;
    result.error_message = 'TCP check requires hostname:port format';
    return result;
  }

  const hostname = targetParts[0];
  const port = parseInt(targetParts[1]);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    (check.timeout_seconds || 30) * 1000
  );

  try {
    const response = await fetch(`http://${hostname}:${port}`, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    result.response_time_ms = Date.now() - startTime;
    result.status_code = response.status;
    result.is_successful = true;
    result.error_message = null;
  } catch (error) {
    clearTimeout(timeout);
    result.response_time_ms = Date.now() - startTime;
    result.is_successful = false;
    result.error_message = `TCP connection to ${hostname}:${port} failed - ${error.message}`;
  }

  return result;
}

// SSL Check execution
async function executeSslCheck(check, result, startTime) {
  let httpsUrl = check.target_url;
  if (!httpsUrl.startsWith('https://')) {
    httpsUrl = `https://${check.target_url}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    (check.timeout_seconds || 30) * 1000
  );

  try {
    const response = await fetch(httpsUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    result.response_time_ms = Date.now() - startTime;
    result.status_code = response.status;
    result.is_successful = response.status < 500;
    result.ssl_info = {
      valid: true,
      expires_at: null,
      days_until_expiry: null,
    };
    result.error_message = result.is_successful
      ? null
      : `SSL check failed with status ${response.status}`;
  } catch (error) {
    clearTimeout(timeout);
    result.response_time_ms = Date.now() - startTime;
    result.is_successful = false;
    result.error_message = `SSL check failed - ${error.message}`;
  }

  return result;
}

// Update monitoring check status and associated service statuses
async function updateMonitoringCheckStatus(checkId, result) {
  try {
    // Store result in check_results table if it exists
    try {
      await db.createCheckResult({
        monitoring_check_id: checkId,
        is_successful: result.is_successful,
        response_time_ms: result.response_time_ms,
        status_code: result.status_code,
        error_message: result.error_message,
        ssl_info: result.ssl_info,
      });
    } catch (resultError) {
      console.warn('Could not store check result:', resultError.message);
    }

    // Get current monitoring check from the monitoring_checks table
    const { data: monitoringCheck, error: fetchError } = await db.client
      .from('monitoring_checks')
      .select('*')
      .eq('id', checkId)
      .single();

    if (fetchError || !monitoringCheck) {
      console.error('Error fetching monitoring check:', fetchError);
      return;
    }

    // Update monitoring check status
    const updateData = {
      current_status: result.is_successful ? 'up' : 'down',
      last_check_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (result.is_successful) {
      updateData.last_success_at = new Date().toISOString();
      updateData.consecutive_successes =
        (monitoringCheck.consecutive_successes || 0) + 1;
      updateData.consecutive_failures = 0;
      updateData.failure_message = null;
    } else {
      updateData.last_failure_at = new Date().toISOString();
      updateData.consecutive_failures =
        (monitoringCheck.consecutive_failures || 0) + 1;
      updateData.consecutive_successes = 0;
      updateData.failure_message = result.error_message;
    }

    const { error: updateError } = await db.client
      .from('monitoring_checks')
      .update(updateData)
      .eq('id', checkId);

    if (updateError) {
      console.error('Error updating monitoring check:', updateError);
    } else {
      console.log(
        `Updated check ${checkId}: ${result.is_successful ? 'SUCCESS' : 'FAILED'} (${result.response_time_ms}ms)`
      );
    }

    // Update associated service statuses via junction table
    await updateLinkedServiceStatus(monitoringCheck, result);
  } catch (error) {
    console.error('Error updating monitoring check status:', error);
  }
}

// Update linked service status based on monitoring check result
async function updateLinkedServiceStatus(monitoringCheck, result) {
  try {
    // Query the service_monitoring_checks junction table to find associated services
    const { data: associations, error: associationError } = await db.client
      .from('service_monitoring_checks')
      .select(
        'service_id, failure_status, failure_threshold_minutes, failure_message'
      )
      .eq('monitoring_check_id', monitoringCheck.id);

    if (associationError) {
      console.error('Error fetching service associations:', associationError);
      return;
    }

    if (!associations || associations.length === 0) {
      console.log(
        `No service associations found for monitoring check ${monitoringCheck.id}`
      );
      return;
    }

    // Update all associated services
    const updateResults = [];
    for (const association of associations) {
      const serviceId = association.service_id;
      const configuredFailureStatus = association.failure_status || 'degraded';
      const customFailureMessage = association.failure_message;

      // Get the linked service
      const { data: linkedService, error: fetchError } = await db.client
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (fetchError || !linkedService) {
        console.warn(
          `Associated service ${serviceId} not found or not accessible`
        );
        continue;
      }

      // Determine new service status based on monitoring result and configuration
      let newStatus = 'operational';
      if (!result.is_successful) {
        // Use the configured failure status instead of auto-determining
        newStatus = configuredFailureStatus;
        console.log(
          `Setting service ${linkedService.name} to ${newStatus} based on configured failure impact`
        );
      }

      // Only update if status actually changed
      if (linkedService.status !== newStatus) {
        const { error: updateError } = await db.client
          .from('services')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', serviceId);

        if (updateError) {
          console.error(
            'Error updating associated service status:',
            updateError
          );
        } else {
          console.log(
            `🔗 Updated associated service ${linkedService.name}: ${linkedService.status} → ${newStatus}`
          );

          updateResults.push({
            serviceName: linkedService.name,
            oldStatus: linkedService.status,
            newStatus: newStatus,
          });

          // Create status update for the service change
          await createServiceStatusUpdate(
            linkedService,
            newStatus,
            monitoringCheck,
            result,
            customFailureMessage
          );
        }
      }
    }

    return updateResults;
  } catch (error) {
    console.error('Error updating linked service status:', error);
  }
}

// Create a status update entry for service status changes
async function createServiceStatusUpdate(
  service,
  newStatus,
  monitoringCheck,
  result,
  customFailureMessage = null
) {
  try {
    // Only create status updates for degraded or down states
    if (newStatus === 'operational') {
      return;
    }

    // Get the status page ID from the service
    if (!service.status_page_id) {
      console.warn(
        `Service ${service.name} (${service.id}) has no status_page_id, cannot create status update`
      );
      return;
    }

    const title = `${service.name} Status Update`;

    // Use custom failure message if provided, otherwise use default message
    let statusMessage;
    if (customFailureMessage && customFailureMessage.trim()) {
      statusMessage = customFailureMessage;
    } else {
      statusMessage =
        newStatus === 'down'
          ? `${service.name} is currently down due to monitoring check failure: ${result.error_message}`
          : `${service.name} is experiencing degraded performance due to monitoring check issues: ${result.error_message}`;
    }

    const { error } = await db.client.from('status_updates').insert({
      status_page_id: service.status_page_id,
      title: title,
      message: statusMessage,
      status: newStatus,
      update_type: 'monitoring',
      created_by: monitoringCheck.created_by,
    });

    if (error) {
      console.error('Error creating status update:', error);
    } else {
      console.log(
        `📝 Created status update for service ${service.name}: ${statusMessage}`
      );
    }
  } catch (error) {
    console.error('Error creating service status update:', error);
  }
}
