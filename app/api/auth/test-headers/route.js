export const runtime = 'edge';

export async function GET() {
  try {
    console.log('🧪 Testing header handling in Edge Runtime');

    // Test creating response with headers from start (should work)
    return new Response(
      JSON.stringify({
        message: 'Headers test successful',
        timestamp: new Date().toISOString(),
        runtime: 'edge',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Header': 'working',
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('❌ Header test error:', error);
    return Response.json({ error: 'Header test failed' }, { status: 500 });
  }
}
