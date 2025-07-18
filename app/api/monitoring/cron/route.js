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
          const lastCheck = check.last_check_at ? new Date(check.last_check_at) : null;
          const nextDue = lastCheck ? 
            new Date(lastCheck.getTime() + (check.check_interval_seconds || 300) * 1000) : 
            'Never checked';
          
          console.log(`⏳ Skipping check: ${check.name} (next due: ${nextDue})`);
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

    console.log(`✅ Cron completed: ${executed} executed, ${skipped} skipped, ${errors} errors`);

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
    console.log(`Executing ${check.check_type} check: ${check.name} -> ${check.target_url}`);

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

// Update monitoring check status
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

    // Update monitoring check status
    const updateData = {
      current_status: result.is_successful ? 'up' : 'down',
      last_check_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (result.is_successful) {
      updateData.last_success_at = new Date().toISOString();
      updateData.failure_message = null;
    } else {
      updateData.last_failure_at = new Date().toISOString();
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
  } catch (error) {
    console.error('Error updating monitoring check status:', error);
  }
}