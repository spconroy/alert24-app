export async function GET() {
  try {
    return Response.json({
      message: 'Basic JSON endpoint working',
      timestamp: new Date().toISOString(),
      status: 'success',
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Basic test failed',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
