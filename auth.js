import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: true, // Enable debug for production debugging
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        console.log('🔐 NextAuth SignIn callback triggered');
        console.log('User:', JSON.stringify(user, null, 2));
        console.log('Account:', JSON.stringify(account, null, 2));
        console.log('Environment check:', {
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
          hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        });

        // For now, allow all Google sign-ins
        // We'll handle user creation after successful authentication
        return true;
      } catch (error) {
        console.error('❌ SignIn callback error:', error);
        return false;
      }
    },
    async session({ session, token }) {
      console.log('🔄 Session callback triggered');
      console.log('Session:', JSON.stringify(session, null, 2));
      console.log('Token:', JSON.stringify(token, null, 2));
      return session;
    },
    async jwt({ token, user, account }) {
      console.log('🎫 JWT callback triggered');
      if (user) {
        console.log('Adding user to token:', user.email);
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
  },
});
