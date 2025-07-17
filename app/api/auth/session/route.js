import { auth } from '../../../../auth.js';

export const runtime = 'edge';

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return Response.json(null);
    }

    return Response.json(session);
  } catch (error) {
    console.error('Session API error:', error);
    return Response.json(null);
  }
}
