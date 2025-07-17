import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import { authOptions } from '../../auth/[...nextauth]/route.js';

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

// Update monitoring check status and linked service status based on result
async function updateMonitoringCheckStatus(checkId, result) {
  try {
    // Get current service entry
    const { data: service, error: fetchError } = await db.client
      .from('services')
      .select('*')
      .eq('id', checkId)
      .ilike('name', '[[]MONITORING]%')
      .single();

    if (fetchError || !service) {
      console.error('Error fetching monitoring check:', fetchError);
      return;
    }

    // Parse and update the stored monitoring data
    const checkData = JSON.parse(service.description);

    // Update status based on result
    checkData.status = result.is_successful ? 'active' : 'down';
    checkData.last_check_time = result.timestamp;
    checkData.last_response_time = result.response_time_ms;
    checkData.last_status_code = result.status_code;
    checkData.last_error = result.error_message;

    // Update SSL info if available
    if (result.ssl_info) {
      checkData.ssl_status = result.ssl_info.valid ? 'valid' : 'invalid';
      checkData.ssl_expires_at = result.ssl_info.expires_at;
      checkData.ssl_days_until_expiry = result.ssl_info.days_until_expiry;
    }

    // Calculate next check time
    const nextCheckTime = new Date(
      Date.now() + (checkData.check_interval || 5) * 60 * 1000
    );
    checkData.next_check_time = nextCheckTime.toISOString();

    const dbData = {
      description: JSON.stringify(checkData),
      status: result.is_successful ? 'operational' : 'down',
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await db.client
      .from('services')
      .update(dbData)
      .eq('id', checkId);

    if (updateError) {
      console.error('Error updating monitoring check:', updateError);
    } else {
      console.log(
        `Updated check ${checkId}: ${result.is_successful ? 'SUCCESS' : 'FAILED'} (${result.response_time_ms}ms)`
      );
    }

    // Update linked service status if association exists
    await updateLinkedServiceStatus(checkData, result);
  } catch (error) {
    console.error('Error updating monitoring check status:', error);
  }
}

// Update the status of a service linked to this monitoring check
async function updateLinkedServiceStatus(checkData, result) {
  try {
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
      }
    }
  } catch (error) {
    console.error('Error updating linked service status:', error);
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
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
