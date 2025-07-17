/**
 * HTTP Database Client for Cloudflare Tunnel with PostgREST + Cloudflare Access
 * Compatible with Edge Runtime
 */

// Configuration
const HTTP_DATABASE_URL = process.env.HTTP_DATABASE_URL;
const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID;
const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET;

/**
 * Get Cloudflare Access Service Auth headers
 */
function getCloudflareMachinePrincipal() {
  if (!CF_ACCESS_CLIENT_ID || !CF_ACCESS_CLIENT_SECRET) {
    console.warn(
      'Cloudflare Access credentials not configured. Trying direct access...'
    );
    return null;
  }

  return {
    'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID,
    'CF-Access-Client-Secret': CF_ACCESS_CLIENT_SECRET,
  };
}

/**
 * Get authentication headers for PostgREST + Cloudflare Access
 */
async function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Prefer: 'return=representation', // PostgREST preference for returning data
  };

  // Add Cloudflare Access Service Auth headers
  const cfHeaders = getCloudflareMachinePrincipal();
  if (cfHeaders) {
    Object.assign(headers, cfHeaders);
  }

  return headers;
}

/**
 * Follow redirects manually to handle Cloudflare Access flow
 */
async function fetchWithRedirects(url, options = {}, maxRedirects = 5) {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual', // Handle redirects manually
    });

    // If not a redirect, return the response
    if (!response.headers.get('location')) {
      return response;
    }

    // Handle redirect
    const location = response.headers.get('location');
    if (!location) {
      return response;
    }

    // Update URL for next request
    currentUrl = location.startsWith('http')
      ? location
      : new URL(location, currentUrl).href;

    redirectCount++;

    // For GET requests, preserve headers through redirects
    if (options.method === 'GET' || !options.method) {
      continue;
    }

    // For POST requests, usually become GET on redirect
    options = {
      ...options,
      method: 'GET',
      body: undefined,
    };
  }

  throw new Error(`Too many redirects (${maxRedirects})`);
}

/**
 * Execute SQL via PostgREST's RPC endpoint
 */
async function executeSQL(sql, params = []) {
  if (!HTTP_DATABASE_URL) {
    throw new Error('HTTP_DATABASE_URL environment variable is required');
  }

  try {
    const headers = await getAuthHeaders();

    // PostgREST RPC endpoint for executing custom SQL
    const response = await fetchWithRedirects(
      `${HTTP_DATABASE_URL}/rpc/execute_sql`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sql_query: sql,
          parameters: params,
        }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      return { rows: Array.isArray(result) ? result : [result] };
    } else {
      const errorText = await response.text();

      // Check if we're getting Cloudflare Access login page
      if (
        errorText.includes('cloudflareaccess.com') ||
        errorText.includes('Invalid redirect URL')
      ) {
        throw new Error(
          `Cloudflare Access authentication failed. Please check CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET environment variables.`
        );
      }

      throw new Error(`PostgREST error ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.error('PostgREST SQL execution error:', error);
    throw error;
  }
}

/**
 * Query PostgREST tables directly (for simple SELECT operations)
 */
async function queryTable(tableName, filters = {}, options = {}) {
  if (!HTTP_DATABASE_URL) {
    throw new Error('HTTP_DATABASE_URL environment variable is required');
  }

  try {
    const headers = await getAuthHeaders();

    // Build query parameters for PostgREST
    const params = new URLSearchParams();

    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      params.append(key, `eq.${value}`);
    });

    // Add options (select, order, limit, etc.)
    if (options.select) params.append('select', options.select);
    if (options.order) params.append('order', options.order);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const queryString = params.toString();
    const url = `${HTTP_DATABASE_URL}/${tableName}${queryString ? `?${queryString}` : ''}`;

    const response = await fetchWithRedirects(url, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const result = await response.json();
      return { rows: Array.isArray(result) ? result : [result] };
    } else {
      const errorText = await response.text();

      if (
        errorText.includes('cloudflareaccess.com') ||
        errorText.includes('Invalid redirect URL')
      ) {
        throw new Error(
          `Cloudflare Access authentication failed. Please check CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET environment variables.`
        );
      }

      throw new Error(
        `PostgREST table query error ${response.status}: ${errorText}`
      );
    }
  } catch (error) {
    console.error('PostgREST table query error:', error);
    throw error;
  }
}

/**
 * Main query function that handles both SQL and table queries
 */
async function httpQuery(sql, params = []) {
  // For now, use the RPC endpoint for all SQL queries
  return await executeSQL(sql, params);
}

/**
 * Test PostgREST connection and discover available endpoints
 */
async function testPostgRESTConnection() {
  if (!HTTP_DATABASE_URL) {
    throw new Error('HTTP_DATABASE_URL environment variable is required');
  }

  try {
    console.log('Testing PostgREST connection through Cloudflare Access...');

    const headers = await getAuthHeaders();

    // Test PostgREST root endpoint (should return OpenAPI spec)
    console.log(`Testing PostgREST root: ${HTTP_DATABASE_URL}/`);

    const response = await fetchWithRedirects(`${HTTP_DATABASE_URL}/`, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    console.log(
      `Root endpoint: ${response.status} - ${text.substring(0, 200)}...`
    );

    if (response.ok && !text.includes('cloudflareaccess.com')) {
      console.log('✅ PostgREST connection successful!');

      // Try to parse as JSON (PostgREST returns OpenAPI spec)
      try {
        const spec = JSON.parse(text);
        if (spec.openapi || spec.swagger) {
          console.log(
            `📋 PostgREST API spec version: ${spec.openapi || spec.swagger}`
          );
          return {
            status: 'connected',
            type: 'postgrest',
            apiSpec: spec,
            response: text,
          };
        }
      } catch (e) {
        // Not JSON, but still successful
      }

      return {
        status: 'connected',
        type: 'postgrest',
        response: text,
      };
    } else if (text.includes('cloudflareaccess.com')) {
      throw new Error(
        'Cloudflare Access authentication failed - Service Auth not working'
      );
    } else {
      throw new Error(
        `PostgREST connection failed: ${response.status} ${text}`
      );
    }
  } catch (error) {
    console.error('PostgREST connection test failed:', error);
    throw error;
  }
}

/**
 * Health check for PostgREST
 */
async function simpleHealthCheck() {
  try {
    const result = await testPostgRESTConnection();
    return { status: 'healthy', ...result };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

// Export the main query function
export async function query(text, params = []) {
  const result = await httpQuery(text, params);
  return result;
}

// Export transaction function (simplified for HTTP)
export async function transaction(callback) {
  // For HTTP connections, we'll execute the callback directly
  // Note: This doesn't provide true transaction isolation
  return await callback(query);
}

/**
 * Test the database connection
 */
export async function testConnection() {
  return await testPostgRESTConnection();
}

// Export health check
export async function healthCheck() {
  return await simpleHealthCheck();
}

// Export PostgREST-specific functions
export { queryTable, executeSQL };

// Export default
export default {
  query,
  transaction,
  testConnection,
  healthCheck,
  queryTable,
  executeSQL,
};
