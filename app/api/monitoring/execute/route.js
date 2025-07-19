import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

// Execute a single monitoring check
async function executeMonitoringCheck(check) {
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
    } else if (check.check_type === 'status_page') {
      return await executeStatusPageCheck(check, result, startTime);
    } else {
      result.error_message = `Unsupported check type: ${check.check_type}`;
      result.response_time_ms = Date.now() - startTime;
      return result;
    }
  } catch (error) {
    result.response_time_ms = Date.now() - startTime;
    result.is_successful = false;

    if (error.name === 'AbortError') {
      result.error_message = `Timeout after ${check.timeout || 30} seconds`;
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
    (check.timeout || 30) * 1000
  );

  const fetchOptions = {
    method: check.http_method || 'GET',
    signal: controller.signal,
    redirect: check.follow_redirects ? 'follow' : 'manual',
    headers: {
      'User-Agent': 'Alert24-Monitor/1.0',
      ...check.http_headers,
    },
  };

  const response = await fetch(check.target_url, fetchOptions);
  clearTimeout(timeoutId);

  const responseTime = Date.now() - startTime;
  result.response_time_ms = responseTime;
  result.status_code = response.status;

  // Check if status code is expected
  const expectedCodes = check.expected_status_codes || [200];
  const statusCodeOk = expectedCodes.includes(response.status);

  // Check keyword matching if configured
  let keywordMatch = true;
  if (check.keyword_match && check.keyword_match.trim()) {
    const responseText = await response.text();
    switch (check.keyword_match_type) {
      case 'exact':
        keywordMatch = responseText === check.keyword_match;
        break;
      case 'regex':
        try {
          const regex = new RegExp(check.keyword_match);
          keywordMatch = regex.test(responseText);
        } catch (e) {
          keywordMatch = false;
          result.error_message = `Invalid regex: ${e.message}`;
        }
        break;
      case 'contains':
      default:
        keywordMatch = responseText.includes(check.keyword_match);
        break;
    }
  }

  // SSL Certificate check for HTTPS URLs
  let sslValid = true;
  if (check.ssl_check_enabled && check.target_url.startsWith('https://')) {
    result.ssl_info = {
      valid: response.ok,
      expires_at: null,
      days_until_expiry: null,
    };
  }

  result.is_successful = statusCodeOk && keywordMatch && sslValid;

  if (!result.is_successful && !result.error_message) {
    const issues = [];
    if (!statusCodeOk)
      issues.push(
        `Status ${response.status} not in expected codes ${expectedCodes.join(',')}`
      );
    if (!keywordMatch) issues.push('Keyword match failed');
    if (!sslValid) issues.push('SSL validation failed');
    result.error_message = issues.join('; ');
  }

  return result;
}

// Ping Check execution
async function executePingCheck(check, result, startTime) {
  // Use target_url directly as hostname/IP since it's no longer a URL for ping checks
  let hostname = check.target_url;

  // If it looks like a URL, extract the hostname (for backward compatibility)
  if (check.target_url.includes('://')) {
    hostname = new URL(check.target_url).hostname;
  }

  // Use a simple TCP connection test as a ping alternative (port 80 for basic connectivity)
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    (check.timeout || 30) * 1000
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
  // Parse hostname:port from target_url
  const targetParts = check.target_url.split(':');
  if (targetParts.length !== 2) {
    result.response_time_ms = Date.now() - startTime;
    result.is_successful = false;
    result.error_message = 'TCP check requires hostname:port format';
    return result;
  }

  const hostname = targetParts[0];
  const port = parseInt(targetParts[1]);

  // Use HTTP request to test TCP connectivity
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    (check.timeout || 30) * 1000
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
  // Ensure we have an HTTPS URL
  let httpsUrl = check.target_url;
  if (!httpsUrl.startsWith('https://')) {
    httpsUrl = `https://${check.target_url}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    (check.timeout || 30) * 1000
  );

  try {
    const response = await fetch(httpsUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    result.response_time_ms = Date.now() - startTime;
    result.status_code = response.status;
    result.is_successful = response.status < 500; // Any response means SSL is working
    result.ssl_info = {
      valid: true,
      expires_at: null, // Would need additional SSL inspection
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

// Status Page Check execution
async function executeStatusPageCheck(check, result, startTime) {
  try {
    // Import the status page scraper
    const { scrapeStatusPage } = await import(
      '../../../../lib/status-page-scraper.js'
    );

    // Extract configuration from status_page_config
    const config = check.status_page_config;
    if (!config || !config.provider || !config.service) {
      result.response_time_ms = Date.now() - startTime;
      result.is_successful = false;
      result.error_message = 'Invalid status page configuration';
      return result;
    }

    console.log(
      `Executing status page check: ${config.provider}/${config.service}`
    );

    // Scrape the status page
    const statusResult = await scrapeStatusPage(
      config.provider,
      config.service,
      config.regions || []
    );

    result.response_time_ms = Date.now() - startTime;

    // Check if the status is successful
    const successfulStatuses = ['up', 'operational'];
    result.is_successful = successfulStatuses.includes(statusResult.status);

    // Set status code based on result
    result.status_code = result.is_successful ? 200 : 503;

    // Set error message if not successful
    if (!result.is_successful) {
      result.error_message = `Status page shows ${statusResult.status} for ${statusResult.provider} ${statusResult.service}`;
    }

    // Store additional status page data
    result.status_page_data = {
      provider: statusResult.provider,
      service: statusResult.service,
      regions: statusResult.regions,
      status: statusResult.status,
      raw_status: statusResult.raw_status,
      url: statusResult.url,
      last_updated: statusResult.last_updated,
    };

    console.log(
      `Status page check result: ${statusResult.status} for ${statusResult.provider}/${statusResult.service}`
    );

    return result;
  } catch (error) {
    result.response_time_ms = Date.now() - startTime;
    result.is_successful = false;
    result.error_message = `Status page check failed: ${error.message}`;
    return result;
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

// Update monitoring check status and linked service status based on result
async function updateMonitoringCheckStatus(checkId, result) {
  try {
    // Store result in dedicated check_results table
    await db.createCheckResult({
      monitoring_check_id: checkId,
      is_successful: result.is_successful,
      response_time_ms: result.response_time_ms,
      status_code: result.status_code,
      response_body: null, // Not storing full response body for now
      response_headers: null,
      error_message: result.error_message,
      ssl_info: result.ssl_info,
    });

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

    // Update monitoring check status and timing information
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

    // Calculate next check time - removed since next_check_at column doesn't exist
    // const intervalSeconds = monitoringCheck.check_interval_seconds || 300;
    // const nextCheckTime = new Date(Date.now() + intervalSeconds * 1000);
    // updateData.next_check_at = nextCheckTime.toISOString();

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
    const updateResults = [];

    // Handle direct linked service (for status page checks)
    if (monitoringCheck.linked_service_id) {
      console.log(
        `Processing direct linked service: ${monitoringCheck.linked_service_id}`
      );

      // Get the linked service
      const { data: linkedService, error: fetchError } = await db.client
        .from('services')
        .select('*')
        .eq('id', monitoringCheck.linked_service_id)
        .single();

      if (fetchError || !linkedService) {
        console.warn(
          `Direct linked service ${monitoringCheck.linked_service_id} not found`
        );
      } else {
        // Process the direct linked service
        const updateResult = await processServiceUpdate(
          linkedService,
          monitoringCheck,
          result,
          monitoringCheck.status_page_config || {}
        );
        if (updateResult) {
          updateResults.push(updateResult);
        }
      }
    }

    // Also handle junction table associations (for backward compatibility)
    const { data: associations, error: associationError } = await db.client
      .from('service_monitoring_checks')
      .select(
        'service_id, failure_status, failure_threshold_minutes, failure_message'
      )
      .eq('monitoring_check_id', monitoringCheck.id);

    if (associationError) {
      console.warn('Error fetching service associations:', associationError);
    } else if (associations && associations.length > 0) {
      console.log(
        `Processing ${associations.length} junction table associations`
      );

      for (const association of associations) {
        const serviceId = association.service_id;
        const configuredFailureStatus =
          association.failure_status || 'degraded';
        const configuredFailureMessage = association.failure_message || null;

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

        // Process the associated service with junction table config
        const updateResult = await processServiceUpdate(
          linkedService,
          monitoringCheck,
          result,
          {
            failure_behavior: 'always_degraded', // Default behavior for junction table
            failure_message: configuredFailureMessage,
          }
        );
        if (updateResult) {
          updateResults.push(updateResult);
        }
      }
    }

    return updateResults;
  } catch (error) {
    console.error('Error updating linked service status:', error);
  }
}

// Helper function to process service updates with failure behavior configuration
async function processServiceUpdate(
  linkedService,
  monitoringCheck,
  result,
  config
) {
  try {
    // Determine new service status based on monitoring result and configuration
    let newStatus = 'operational';
    let failureMessage = null;

    if (!result.is_successful) {
      // Get the failure behavior from config
      const failureBehavior = config.failure_behavior || 'match_status';
      const customFailureMessage = config.failure_message;

      // Determine the new status based on failure behavior
      if (failureBehavior === 'always_down') {
        newStatus = 'down';
      } else if (failureBehavior === 'always_degraded') {
        newStatus = 'degraded';
      } else if (failureBehavior === 'match_status') {
        // Match the provider status for status page checks
        if (result.status_page_data) {
          const providerStatus = result.status_page_data.status;
          if (providerStatus === 'down') {
            newStatus = 'down';
          } else {
            newStatus = 'degraded'; // Any non-up status becomes degraded
          }
        } else {
          newStatus = 'degraded'; // Default for non-status-page checks
        }
      }

      // Set failure message
      if (customFailureMessage && customFailureMessage.trim()) {
        failureMessage = customFailureMessage;
      } else {
        // Generate default message based on check type
        if (
          monitoringCheck.check_type === 'status_page' &&
          result.status_page_data
        ) {
          const provider = result.status_page_data.provider;
          const service = result.status_page_data.service;
          const status = result.status_page_data.status;
          failureMessage = `${provider} ${service} is reporting ${status} status`;
        } else {
          failureMessage = result.error_message || 'Monitoring check failed';
        }
      }

      console.log(
        `Setting service ${linkedService.name} to ${newStatus} due to ${failureBehavior} behavior`
      );
    }

    // Only update if status actually changed
    if (linkedService.status !== newStatus) {
      const oldStatus = linkedService.status;

      const { error: updateError } = await db.client
        .from('services')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkedService.id);

      if (updateError) {
        console.error('Error updating linked service status:', updateError);
        return null;
      } else {
        console.log(
          `🔗 Updated linked service ${linkedService.name}: ${oldStatus} → ${newStatus}`
        );

        // Manually track the status change for SLA calculation
        await db.trackServiceStatusChange(
          linkedService.id,
          newStatus,
          oldStatus
        );

        // Create status update for the service change
        await createServiceStatusUpdate(
          linkedService,
          newStatus,
          monitoringCheck,
          result,
          failureMessage
        );

        return {
          serviceName: linkedService.name,
          oldStatus: oldStatus,
          newStatus: newStatus,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error processing service update:', error);
    return null;
  }
}

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { checkId, executeAll, organizationId } = await req.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let checksToExecute = [];

    if (checkId) {
      // Execute specific check
      const checks = await db.getMonitoringChecks(user.id, {
        organization_id: organizationId,
      });
      const check = checks.find(c => c.id === checkId);
      if (check) {
        checksToExecute = [check];
      }
    } else if (executeAll && organizationId) {
      // Execute all checks for organization
      checksToExecute = await db.getMonitoringChecks(user.id, {
        organization_id: organizationId,
      });
    } else {
      return NextResponse.json(
        { error: 'Either checkId or executeAll with organizationId required' },
        { status: 400 }
      );
    }

    if (checksToExecute.length === 0) {
      return NextResponse.json(
        { error: 'No monitoring checks found' },
        { status: 404 }
      );
    }

    // Execute checks
    const results = [];
    for (const check of checksToExecute) {
      const result = await executeMonitoringCheck(check);
      await updateMonitoringCheckStatus(check.id, result);
      results.push({
        checkId: check.id,
        checkName: check.name,
        success: result.is_successful,
        responseTime: result.response_time_ms,
        statusCode: result.status_code,
        error: result.error_message,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Executed ${results.length} monitoring checks`,
      results: results,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error executing monitoring checks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute monitoring checks',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
