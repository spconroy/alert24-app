// OLD NEXTAUTH ROUTE - DISABLED
// We're now using custom Google OAuth implementation
// Redirect any NextAuth requests to our custom auth

export const runtime = 'edge';

export async function GET(request) {
  const url = new URL(request.url);

  // If someone tries to access old NextAuth routes, redirect to our custom auth
  if (url.pathname.includes('/signin') || url.pathname.includes('/callback')) {
    return Response.redirect(`${process.env.NEXTAUTH_URL}/auth/signin`);
  }

  return Response.json(
    {
      error: 'NextAuth routes disabled - using custom Google OAuth',
      customAuthEndpoints: {
        signin: '/api/auth/google/signin',
        callback: '/api/auth/google/callback',
        session: '/api/auth/session',
        signout: '/api/auth/signout',
      },
    },
    { status: 410 }
  );
}

export async function POST(request) {
  // Redirect POST requests as well
  return Response.redirect(`${process.env.NEXTAUTH_URL}/auth/signin`);
}
