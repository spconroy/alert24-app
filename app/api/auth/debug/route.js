export const runtime = 'edge';

export async function GET() {
  try {
    const envCheck = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'present' : 'missing',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'present' : 'missing',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'present' : 'missing',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    };

    return Response.json({
      success: true,
      environment: envCheck,
      timestamp: new Date().toISOString(),
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