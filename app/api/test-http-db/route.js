import { query, healthCheck, testConnection } from '@/lib/db-http';

export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Testing HTTP database connection...');

    // Test basic connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return Response.json(
        {
          success: false,
          error: 'Database connection failed',
        },
        { status: 500 }
      );
    }

    // Get health check info
    const health = await healthCheck();

    // Test a simple query
    const testQuery = await query(
      'SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = $1',
      ['alert24_schema']
    );

    return Response.json({
      success: true,
      message: 'HTTP Database connection successful!',
      connection: {
        url: process.env.HTTP_DATABASE_URL,
        authenticated: true,
        runtime: 'edge',
      },
      health,
      test_query: testQuery.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('HTTP Database test error:', error);

    return Response.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        connection: {
          url: process.env.HTTP_DATABASE_URL ? 'configured' : 'missing',
          jwt_secret: process.env.JWT_SECRET ? 'configured' : 'missing',
        },
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

    const result = await query(sql, params);

    return Response.json({
      success: true,
      result: result.rows,
      row_count: result.rows.length,
    });
  } catch (error) {
    console.error('HTTP Database query error:', error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
