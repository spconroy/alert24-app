// Note: Signup is not handled here. See /api/auth/signup for registration logic.
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import bcrypt from 'bcrypt';

const db = new SupabaseClient();

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'user@example.com',
        },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }

        try {
          // Use Supabase client to find user
          const user = await db.getUserByEmail(credentials.email);

          if (!user || !user.password) {
            throw new Error('No user found');
          }

          // Verify password using bcrypt
          const isValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isValid) {
            throw new Error('Invalid password');
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
          };
        } catch (error) {
          console.error('Authorization error:', error);
          throw new Error('Authentication failed');
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token, user }) {
      // Attach user id to session
      if (token?.sub) session.user.id = token.sub;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
