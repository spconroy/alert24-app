import { testConnection } from '@/lib/db-http-cloudflare';

export async function GET() {
  try {
    console.log('Testing PostgREST connection through Cloudflare Access...');

    const HTTP_DATABASE_URL = process.env.HTTP_DATABASE_URL;
    const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID;
    const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET;

    // Test the PostgREST connection
    const connectionResult = await testConnection();

    return Response.json({
      success: true,
      message: 'PostgREST connection test completed',
      baseUrl: HTTP_DATABASE_URL,
      hasCredentials: {
        client_id: !!CF_ACCESS_CLIENT_ID,
        client_secret: !!CF_ACCESS_CLIENT_SECRET,
      },
      connectionResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('PostgREST connection test error:', error);

    return Response.json(
      {
        success: false,
        error: error.message,
        baseUrl: process.env.HTTP_DATABASE_URL,
        hasCredentials: {
          client_id: !!process.env.CF_ACCESS_CLIENT_ID,
          client_secret: !!process.env.CF_ACCESS_CLIENT_SECRET,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { sql, params = [] } = await request.json();

    if (!sql) {
      return Response.json(
        {
          success: false,
          error: 'SQL query is required',
        },
        { status: 400 }
      );
    }

    // Import query function dynamically to avoid import issues
    const { query } = await import('@/lib/db-http-cloudflare');
    const result = await query(sql, params);

    return Response.json({
      success: true,
      result: result.rows,
      row_count: result.rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('PostgREST query error:', error);

    return Response.json(
      {
        success: false,
        error: error.message,
        details:
          'This might be due to Cloudflare Access authentication or PostgREST configuration',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
