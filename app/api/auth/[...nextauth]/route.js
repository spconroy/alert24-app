// Note: Signup is not handled here. See /api/auth/signup for registration logic.
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
// import prisma from '@/lib/prisma';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const handler = NextAuth({
  adapter: PrismaAdapter(pool), // Adapter is still required for NextAuth, but not used for login
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }
        // Use raw SQL to find user
        const { rows } = await pool.query(
          'SELECT id, name, email, password FROM public.users WHERE email = $1',
          [credentials.email]
        );
        const user = rows[0];
        if (!user || !user.password) {
          throw new Error('No user found');
        }
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error('Invalid password');
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
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
});

export { handler as GET, handler as POST }; 