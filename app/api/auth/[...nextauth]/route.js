import { handlers } from '../../../../auth.js';

export const runtime = 'edge';

export const GET = async req => {
  try {
    console.log('🔵 NextAuth GET handler called');
    console.log('🔵 Request URL:', req.url);
    console.log('🔵 Environment check:', {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    });

    return await handlers.GET(req);
  } catch (error) {
    console.error('❌ NextAuth GET handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'NextAuth GET handler failed',
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
};

export const POST = async req => {
  try {
    console.log('🟠 NextAuth POST handler called');
    console.log('🟠 Request URL:', req.url);

    return await handlers.POST(req);
  } catch (error) {
    console.error('❌ NextAuth POST handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'NextAuth POST handler failed',
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
};
