export const runtime = 'edge';

export async function GET() {
  try {
    // Test 1: Basic Edge Runtime
    console.log('✅ Edge Runtime is working');

    // Test 2: Environment Variables
    const envVars = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
        ? 'Set'
        : 'Missing',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'Set' : 'Missing',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'Not set',
      NODE_ENV: process.env.NODE_ENV || 'Not set',
    };

    // Test 3: Crypto API (required for NextAuth tokens)
    let cryptoTest = 'Failed';
    try {
      const buffer = new Uint8Array(8);
      crypto.getRandomValues(buffer);
      cryptoTest = 'Working';
    } catch (error) {
      cryptoTest = `Failed: ${error.message}`;
    }

    // Test 4: JSON Response
    const response = {
      timestamp: new Date().toISOString(),
      runtime: 'edge',
      status: 'success',
      environment: envVars,
      cryptoAPI: cryptoTest,
      tests: {
        edgeRuntime: '✅ Working',
        environmentVars:
          envVars.GOOGLE_CLIENT_ID === 'Set' ? '✅ Working' : '❌ Missing vars',
        cryptoAPI: cryptoTest === 'Working' ? '✅ Working' : '❌ Failed',
      },
      nextSteps: [
        'If this endpoint works, the issue is in NextAuth configuration',
        "If this endpoint fails, there's a basic Edge Runtime issue",
        'Check Cloudflare Functions logs for detailed error messages',
      ],
    };

    console.log('Test results:', response);
    return Response.json(response);
  } catch (error) {
    console.error('❌ Minimal test failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Minimal test failed',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
