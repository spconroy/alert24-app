import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import { authOptions } from '../../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { check_id } = body;

    if (!check_id) {
      return NextResponse.json(
        { error: 'check_id is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get monitoring check
    const check = await db.getMonitoringCheckById(check_id);
    if (!check) {
      return NextResponse.json(
        { error: 'Monitoring check not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this organization
    const membership = await db.getOrganizationMember(
      check.organization_id,
      user.id
    );
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied - not a member of this organization' },
        { status: 403 }
      );
    }

    // Execute the monitoring check
    console.log(
      `Executing monitoring check: ${check.name} (${check.check_type})`
    );
    const result = await executeMonitoringCheck(check);

    // Store the result in database
    const checkResult = await db.createCheckResult({
      monitoring_check_id: check.id,
      is_successful: result.is_successful,
      response_time: result.response_time,
      status_code: result.status_code,
      error_message: result.error_message,
      response_body: result.response_body,
    });

    return NextResponse.json({
      success: true,
      check_result: checkResult,
      execution_summary: {
        check_id: check.id,
        check_name: check.name,
        check_type: check.check_type,
        is_successful: result.is_successful,
        response_time: result.response_time,
        status_code: result.status_code,
        executed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error executing monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper function to execute different types of monitoring checks
async function executeMonitoringCheck(check) {
  const startTime = Date.now();

  try {
    switch (check.check_type) {
      case 'http':
      case 'https':
        return await executeHttpCheck(check);
      case 'ping':
        return await executePingCheck(check);
      case 'tcp':
        return await executeTcpCheck(check);
      default:
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
  const {
    target_url,
    timeout_seconds,
    expected_response_code,
    expected_response_body,
  } = check;
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
        Accept: '*/*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;

    // Check if status code matches expected
    const expectedCode = expected_response_code || 200;
    let isSuccessful = statusCode === expectedCode;
    let errorMessage = null;

    if (!isSuccessful) {
      errorMessage = `HTTP ${statusCode} (expected ${expectedCode})`;
    }

    // Get response body for keyword checking
    let responseBody = '';
    try {
      responseBody = await response.text();

      // Check for expected response body content if specified
      if (isSuccessful && expected_response_body) {
        if (!responseBody.includes(expected_response_body)) {
          isSuccessful = false;
          errorMessage = `Response body does not contain expected text: "${expected_response_body}"`;
        }
      }
    } catch (e) {
      // Ignore body read errors but log them
      console.warn('Could not read response body:', e.message);
    }

    return {
      is_successful: isSuccessful,
      response_time: responseTime,
      status_code: statusCode,
      error_message: errorMessage,
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
  const { target_url, timeout_seconds } = check;
  const startTime = Date.now();

  try {
    // Extract hostname from URL if it's a full URL
    let hostname = target_url;
    try {
      const url = new URL(target_url);
      hostname = url.hostname;
    } catch (e) {
      // target_url might already be just a hostname
    }

    // Use HTTP HEAD request as a ping alternative since we can't do ICMP ping in browser/serverless
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (timeout_seconds || 10) * 1000
    );

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

async function executeTcpCheck(check) {
  const { target_url, target_port, timeout_seconds } = check;
  const startTime = Date.now();

  try {
    // For TCP checks, we'll try to make an HTTP connection to the port
    // This is a simplified check since we can't do raw TCP in serverless
    let hostname = target_url;
    try {
      const url = new URL(target_url);
      hostname = url.hostname;
    } catch (e) {
      // target_url might already be just a hostname
    }

    const port = target_port || 80;
    const testUrl = `http://${hostname}:${port}`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (timeout_seconds || 10) * 1000
    );

    const response = await fetch(testUrl, {
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
    // For TCP checks, connection refused might actually mean the port is closed
    const isConnectionError =
      error.message.includes('fetch') || error.message.includes('network');

    return {
      is_successful: false,
      response_time: Date.now() - startTime,
      status_code: null,
      error_message: isConnectionError ? 'Connection failed' : error.message,
      response_body: null,
    };
  }
}
