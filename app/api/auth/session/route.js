import { auth } from '../../../../auth.js';

export const runtime = 'edge';

export async function GET(req) {
  try {
    console.log('🔍 Session API called');
    console.log('🔍 Request URL:', req.url);
    console.log('🔍 Environment check:', {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    });

    const session = await auth();

    if (!session) {
      console.log('❌ No session found');
      return Response.json(null);
    }

    console.log('✅ Session found for user:', session.user?.email);

    // Return a clean session object
    const cleanSession = {
      user: {
        email: session.user?.email,
        name: session.user?.name,
        image: session.user?.image,
      },
      expires: session.expires,
    };

    return Response.json(cleanSession);
  } catch (error) {
    console.error('❌ Session API error:', error);
    console.error('❌ Error stack:', error.stack);

    // Return null session instead of error to prevent auth loops
    return Response.json(null);
  }
}
