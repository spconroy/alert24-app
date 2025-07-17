import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../../lib/db-supabase.js';

const db = new SupabaseClient();

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

          executionResults.push({
            check_id: check.id,
            check_name: check.name,
            success: result.is_successful,
            response_time: result.response_time,
            error: result.error_message,
          });

          // If check failed, could trigger notifications here
          if (!result.is_successful) {
            console.log(
              `Check failed: ${check.name} - ${result.error_message}`
            );
            // TODO: Trigger escalation/notification logic
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
      error_message: response.status < 500 ? null : `SSL check failed with status ${response.status}`,
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
