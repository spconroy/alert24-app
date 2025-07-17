
import { query } from '@/lib/db-edge';

export async function GET() {
  try {
    // Test database connection
    const result = await query(
      'SELECT NOW() as current_time, VERSION() as version'
    );

    return Response.json({
      success: true,
      message: 'Edge Runtime + PostgreSQL working!',
      data: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Edge API Error:', error);
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Example: Test a simple query with parameters
    const result = await query('SELECT $1 as message, $2 as number', [
      body.message || 'Hello from Edge Runtime!',
      body.number || 42,
    ]);

    return Response.json({
      success: true,
      echo: result.rows[0],
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
