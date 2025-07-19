export const runtime = 'edge';

export async function GET() {
  return Response.json({
    timestamp: new Date().toISOString(),
    environment: 'Cloudflare Edge',
    config: {
      nextAuthUrl: process.env.NEXTAUTH_URL || 'NOT SET',
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
      googleClientId: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
    },
    expectedRedirectUri: `${process.env.NEXTAUTH_URL || 'https://app.alert24.net'}/api/auth/callback/google`,
    recommendations: [
      'Ensure NEXTAUTH_URL exactly matches: https://app.alert24.net',
      'Ensure Google OAuth redirect URI includes: https://app.alert24.net/api/auth/callback/google',
      'Set environment variables in BOTH Production and Preview in Cloudflare Pages',
      'Redeploy after setting environment variables',
    ],
  });
}
