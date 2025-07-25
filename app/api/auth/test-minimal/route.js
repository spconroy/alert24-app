export const runtime = 'edge';

export async function GET() {
  try {
    return Response.json({
      status: 'working',
      timestamp: new Date().toISOString(),
      message: 'Minimal test endpoint is functional',
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
