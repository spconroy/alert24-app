
export const runtime = 'edge';

export async function GET() {
  const HTTP_DATABASE_URL = process.env.HTTP_DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET;

  try {
    // Step 1: Check environment variables
    if (!HTTP_DATABASE_URL) {
      return Response.json(
        {
          step: 1,
          success: false,
          error: 'HTTP_DATABASE_URL not configured',
          env_check: {
            HTTP_DATABASE_URL: 'missing',
            JWT_SECRET: JWT_SECRET ? 'present' : 'missing',
          },
        },
        { status: 500 }
      );
    }

    if (!JWT_SECRET) {
      return Response.json(
        {
          step: 1,
          success: false,
          error: 'JWT_SECRET not configured',
          env_check: {
            HTTP_DATABASE_URL: 'present',
            JWT_SECRET: 'missing',
          },
        },
        { status: 500 }
      );
    }

    // Step 2: Test basic connectivity to the endpoint
    console.log('Testing connectivity to:', HTTP_DATABASE_URL);

    const connectTest = await fetch(HTTP_DATABASE_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const connectStatus = connectTest.status;
    const connectText = await connectTest.text();

    // Step 3: Generate JWT token
    let token;
    try {
      const header = {
        alg: 'HS256',
        typ: 'JWT',
      };

      const payload = {
        role: 'authenticated',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      };

      const encodedHeader = btoa(JSON.stringify(header)).replace(
        /[=+/]/g,
        c => ({ '=': '', '+': '-', '/': '_' })[c]
      );

      const encodedPayload = btoa(JSON.stringify(payload)).replace(
        /[=+/]/g,
        c => ({ '=': '', '+': '-', '/': '_' })[c]
      );

      const message = `${encodedHeader}.${encodedPayload}`;

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

      token = `${message}.${encodedSignature}`;
    } catch (jwtError) {
      return Response.json(
        {
          step: 3,
          success: false,
          error: 'JWT generation failed',
          jwt_error: jwtError.message,
          connectivity: {
            status: connectStatus,
            response: connectText.substring(0, 200),
          },
        },
        { status: 500 }
      );
    }

    // Step 4: Test different endpoints
    const endpoints = ['/rpc/execute_sql', '/rpc/health_check', '/health', '/'];

    const endpointTests = {};

    for (const endpoint of endpoints) {
      try {
        const testResponse = await fetch(`${HTTP_DATABASE_URL}${endpoint}`, {
          method: endpoint === '/rpc/execute_sql' ? 'POST' : 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body:
            endpoint === '/rpc/execute_sql'
              ? JSON.stringify({ query: 'SELECT 1 as test' })
              : undefined,
        });

        const responseText = await testResponse.text();
        endpointTests[endpoint] = {
          status: testResponse.status,
          ok: testResponse.ok,
          response: responseText.substring(0, 200),
        };
      } catch (err) {
        endpointTests[endpoint] = {
          status: 'error',
          error: err.message,
        };
      }
    }

    return Response.json({
      success: true,
      debug_info: {
        step: 'completed',
        environment: {
          HTTP_DATABASE_URL: HTTP_DATABASE_URL,
          JWT_SECRET_LENGTH: JWT_SECRET.length,
        },
        connectivity: {
          status: connectStatus,
          response_preview: connectText.substring(0, 200),
        },
        jwt_token: {
          generated: true,
          length: token.length,
          preview: token.substring(0, 50) + '...',
        },
        endpoint_tests: endpointTests,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
