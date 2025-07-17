/**
 * HTTP Database Client for Cloudflare Tunnel with JWT Authentication
 * Compatible with Edge Runtime
 */

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.DATABASE_JWT_SECRET;
const HTTP_DATABASE_URL = process.env.HTTP_DATABASE_URL;

/**
 * Generate JWT token for database authentication
 */
async function generateJWTToken(payload = {}) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const defaultPayload = {
    role: 'authenticated', // or 'anon' for anonymous access
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiry
    ...payload,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(
    /[=+/]/g,
    c => ({ '=': '', '+': '-', '/': '_' })[c]
  );

  const encodedPayload = btoa(JSON.stringify(defaultPayload)).replace(
    /[=+/]/g,
    c => ({ '=': '', '+': '-', '/': '_' })[c]
  );

  const message = `${encodedHeader}.${encodedPayload}`;

  // Use Web Crypto API (Edge Runtime compatible)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );
  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  ).replace(/[=+/]/g, c => ({ '=': '', '+': '-', '/': '_' })[c]);

  return `${message}.${encodedSignature}`;
}

/**
 * Execute HTTP database query
 */
async function httpQuery(sql, params = []) {
  if (!HTTP_DATABASE_URL) {
    throw new Error('HTTP_DATABASE_URL environment variable is required');
  }

  try {
    const token = await generateJWTToken();

    const response = await fetch(`${HTTP_DATABASE_URL}/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: sql,
        params: params,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return { rows: result.data || result.rows || result };
  } catch (error) {
    console.error('HTTP Database query error:', error);
    throw error;
  }
}

/**
 * Alternative query method using PostgREST-style endpoints
 */
async function restQuery(table, options = {}) {
  if (!HTTP_DATABASE_URL) {
    throw new Error('HTTP_DATABASE_URL environment variable is required');
  }

  try {
    const token = await generateJWTToken();
    const { select, filter, limit, order } = options;

    let url = `${HTTP_DATABASE_URL}/${table}`;
    const params = new URLSearchParams();

    if (select) params.append('select', select);
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });
    }
    if (limit) params.append('limit', limit);
    if (order) params.append('order', order);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return { rows: Array.isArray(result) ? result : [result] };
  } catch (error) {
    console.error('REST query error:', error);
    throw error;
  }
}

/**
 * Main query function compatible with existing code
 */
export async function query(text, params = []) {
  return await httpQuery(text, params);
}

/**
 * Transaction support via HTTP
 */
export async function transaction(callback) {
  // For HTTP-based queries, we'll execute in a transaction block
  const token = await generateJWTToken();

  const client = {
    query: async (text, params = []) => {
      return await httpQuery(text, params);
    },
  };

  try {
    await httpQuery('BEGIN');
    const result = await callback(client);
    await httpQuery('COMMIT');
    return result;
  } catch (error) {
    await httpQuery('ROLLBACK');
    throw error;
  }
}

/**
 * Connection test
 */
export async function testConnection() {
  try {
    const result = await httpQuery('SELECT 1 as test, NOW() as timestamp');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

/**
 * Health check endpoint
 */
export async function healthCheck() {
  try {
    const result = await httpQuery(`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        NOW() as timestamp
    `);
    return {
      status: 'healthy',
      ...result.rows[0],
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

// Export REST query function for direct table access
export { restQuery };

export default {
  query,
  transaction,
  testConnection,
  healthCheck,
  restQuery,
  generateJWTToken,
};
