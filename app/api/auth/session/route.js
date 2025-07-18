import { auth } from '../../../../auth.js';

export const runtime = 'edge';

export async function GET() {
  try {
    console.log('🔍 Session API called');
    const session = await auth();

    if (!session) {
      console.log('❌ No session found');
      return Response.json(null);
    }

    console.log('✅ Session found for user:', session.user?.email);
    return Response.json(session);
  } catch (error) {
    console.error('❌ Session API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
