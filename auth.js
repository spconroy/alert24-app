import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// Minimal configuration for Edge Runtime compatibility
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: true,
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔐 SignIn callback - User:', user?.email);
      console.log('🔐 SignIn callback - Account:', account?.provider);

      // Minimal check - just ensure we have a Google account
      if (account?.provider === 'google' && user?.email) {
        console.log('✅ Google OAuth successful for:', user.email);
        return true;
      }

      console.log('❌ SignIn rejected - invalid provider or missing email');
      return false;
    },
    async session({ session, token }) {
      console.log('🔄 Session callback');
      if (token?.email) {
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      console.log('🎫 JWT callback');
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
  },
});
