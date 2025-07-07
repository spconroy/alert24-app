import { getServerSession } from 'next-auth';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Monitoring check execution functions
async function executeHttpCheck(check) {
  const { target_url, configuration, target_timeout } = check;
  const {
    http_method = 'GET',
    http_headers = {},
    expected_status_codes = [200],
    follow_redirects = true,
    ssl_check_enabled = false,
  } = configuration;

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (target_timeout || 30) * 1000
    );

    const fetchOptions = {
      method: http_method,
      headers: {
        'User-Agent': 'Alert24-Monitor/1.0',
        ...http_headers,
      },
      redirect: follow_redirects ? 'follow' : 'manual',
      signal: controller.signal,
    };

    const response = await fetch(target_url, fetchOptions);
    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    const isSuccessful = expected_status_codes.includes(statusCode);

    // Get response body for keyword matching if needed
    let responseBody = '';
    if (configuration.keyword_match) {
      responseBody = await response.text();
    }

    // Check for keyword match if configured
    let keywordResult = null;
    if (configuration.keyword_match) {
      const keyword = configuration.keyword_match;
      const matchType = configuration.keyword_match_type || 'contains';
      const caseSensitive = configuration.case_sensitive || false;

      const searchText = caseSensitive
        ? responseBody
        : responseBody.toLowerCase();
      const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();

      let keywordFound = false;
      if (matchType === 'contains') {
        keywordFound = searchText.includes(searchKeyword);
      } else if (matchType === 'exact') {
        keywordFound = searchText === searchKeyword;
      } else if (matchType === 'regex') {
        const regex = new RegExp(keyword, caseSensitive ? 'g' : 'gi');
        keywordFound = regex.test(responseBody);
      }

      keywordResult = {
        keyword,
        found: keywordFound,
        match_type: matchType,
        case_sensitive: caseSensitive,
      };
    }

    return {
      is_successful:
        isSuccessful && (!configuration.keyword_match || keywordResult?.found),
      response_time: responseTime,
      status_code: statusCode,
      response_headers: Object.fromEntries(response.headers),
      response_body: configuration.keyword_match
        ? responseBody.substring(0, 1000)
        : null, // Limit body size
      keyword_results: keywordResult,
      error_message: isSuccessful
        ? null
        : `Unexpected status code: ${statusCode}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      is_successful: false,
      response_time: responseTime,
      status_code: null,
      response_headers: null,
      response_body: null,
      keyword_results: null,
      error_message: error.message || 'Network error',
    };
  }
}

async function executePingCheck(check) {
  // For ping checks, we'll use a simple TCP connect since fetch API doesn't support ICMP
  const { target_url, target_timeout } = check;
  const startTime = Date.now();

  try {
    // Extract hostname from URL if it's a full URL
    let hostname = target_url;
    if (target_url.includes('://')) {
      hostname = new URL(target_url).hostname;
    }

    // Use a simple HTTP request to check connectivity
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (target_timeout || 10) * 1000
    );

    await fetch(`http://${hostname}`, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors', // Avoid CORS issues
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    return {
      is_successful: true,
      response_time: responseTime,
      status_code: null,
      response_headers: null,
      response_body: null,
      error_message: null,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      is_successful: false,
      response_time: responseTime,
      status_code: null,
      response_headers: null,
      response_body: null,
      error_message: error.message || 'Ping failed',
    };
  }
}

async function executeTcpCheck(check) {
  const { target_url, target_port, target_timeout } = check;
  const startTime = Date.now();

  try {
    // Extract hostname from URL if needed
    let hostname = target_url;
    if (target_url.includes('://')) {
      hostname = new URL(target_url).hostname;
    }

    const port = target_port || 80;

    // Use WebSocket to test TCP connectivity
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (target_timeout || 10) * 1000
    );

    // Try to establish a connection
    const ws = new WebSocket(`ws://${hostname}:${port}`);

    return new Promise(resolve => {
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        const responseTime = Date.now() - startTime;

        resolve({
          is_successful: true,
          response_time: responseTime,
          status_code: null,
          response_headers: null,
          response_body: null,
          error_message: null,
        });
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;

        resolve({
          is_successful: false,
          response_time: responseTime,
          status_code: null,
          response_headers: null,
          response_body: null,
          error_message: `TCP connection to ${hostname}:${port} failed`,
        });
      };

      controller.signal.addEventListener('abort', () => {
        ws.close();
        const responseTime = Date.now() - startTime;

        resolve({
          is_successful: false,
          response_time: responseTime,
          status_code: null,
          response_headers: null,
          response_body: null,
          error_message: 'TCP check timed out',
        });
      });
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      is_successful: false,
      response_time: responseTime,
      status_code: null,
      response_headers: null,
      response_body: null,
      error_message: error.message || 'TCP check failed',
    };
  }
}

async function executeSslCheck(check) {
  const { target_url, target_timeout } = check;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (target_timeout || 30) * 1000
    );

    // Make HTTPS request to check SSL certificate
    const httpsUrl = target_url.startsWith('https://')
      ? target_url
      : `https://${target_url}`;

    const response = await fetch(httpsUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    // For SSL checks, success means we could establish an HTTPS connection
    const isSuccessful = response.status < 500; // Any response means SSL is working

    return {
      is_successful: isSuccessful,
      response_time: responseTime,
      status_code: response.status,
      response_headers: Object.fromEntries(response.headers),
      response_body: null,
      ssl_certificate_info: {
        // In a real implementation, you'd extract certificate details
        // For now, we'll just note that SSL validation passed
        ssl_verified: true,
        checked_at: new Date().toISOString(),
      },
      error_message: isSuccessful
        ? null
        : `SSL check failed with status ${response.status}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      is_successful: false,
      response_time: responseTime,
      status_code: null,
      response_headers: null,
      response_body: null,
      ssl_certificate_info: null,
      error_message: error.message || 'SSL check failed',
    };
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { check_id, location_id = null } = body;

    if (!check_id) {
      return new Response(JSON.stringify({ error: 'check_id is required' }), {
        status: 400,
      });
    }

    // Get the monitoring check details
    const checkRes = await pool.query(
      'SELECT * FROM public.monitoring_checks WHERE id = $1 AND status = $2',
      [check_id, 'active']
    );

    if (checkRes.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Monitoring check not found or not active' }),
        { status: 404 }
      );
    }

    const check = checkRes.rows[0];

    // Execute the check based on its type
    let result;
    switch (check.check_type) {
      case 'http':
      case 'https':
        result = await executeHttpCheck(check);
        break;
      case 'ping':
        result = await executePingCheck(check);
        break;
      case 'tcp':
        result = await executeTcpCheck(check);
        break;
      case 'ssl':
        result = await executeSslCheck(check);
        break;
      default:
        return new Response(
          JSON.stringify({
            error: `Unsupported check type: ${check.check_type}`,
          }),
          { status: 400 }
        );
    }

    // Get or create a default monitoring location if none specified
    let monitoringLocationId = location_id;
    if (!monitoringLocationId) {
      const defaultLocationRes = await pool.query(
        'SELECT id FROM public.monitoring_locations WHERE is_default = true LIMIT 1'
      );

      if (defaultLocationRes.rows.length === 0) {
        // Create a default location if none exists
        const createLocationRes = await pool.query(
          `INSERT INTO public.monitoring_locations (name, code, region, country, is_default, is_active)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          ['Default Location', 'default', 'Local', 'Local', true, true]
        );
        monitoringLocationId = createLocationRes.rows[0].id;
      } else {
        monitoringLocationId = defaultLocationRes.rows[0].id;
      }
    }

    // Store the result in the database
    const insertRes = await pool.query(
      `INSERT INTO public.check_results (
        monitoring_check_id, monitoring_location_id, is_successful, response_time,
        status_code, response_headers, response_body, error_message,
        ssl_certificate_info, keyword_results
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        check_id,
        monitoringLocationId,
        result.is_successful,
        result.response_time,
        result.status_code,
        result.response_headers
          ? JSON.stringify(result.response_headers)
          : null,
        result.response_body,
        result.error_message,
        result.ssl_certificate_info
          ? JSON.stringify(result.ssl_certificate_info)
          : null,
        result.keyword_results ? JSON.stringify(result.keyword_results) : null,
      ]
    );

    const checkResult = insertRes.rows[0];

    // The database trigger will automatically handle incident creation/resolution
    // based on the check result

    return new Response(
      JSON.stringify({
        check_result: checkResult,
        execution_details: {
          check_type: check.check_type,
          target: check.target_url,
          ...result,
        },
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Check execution error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
