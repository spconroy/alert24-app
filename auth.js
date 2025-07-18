import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { SupabaseClient } from './lib/db-supabase.js';

const db = new SupabaseClient();

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
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        console.log('🔐 SignIn attempt for:', user.email);
        // Check if user exists in our database
        let existingUser = await db.getUserByEmail(user.email);

        if (!existingUser) {
          console.log('👤 Creating new user:', user.email);
          // Create new user if doesn't exist
          const userData = {
            name: user.name,
            email: user.email,
            avatar_url: user.image,
            provider: 'google',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: newUser, error } = await db.client
            .from('users')
            .insert(userData)
            .select()
            .single();

          if (error) {
            console.error('❌ Error creating user:', error);
            return false;
          }

          existingUser = newUser;
          console.log('✅ User created successfully:', existingUser.id);
        } else {
          console.log('✅ Existing user found:', existingUser.id);
        }

        return true;
      } catch (error) {
        console.error('❌ SignIn callback error:', error);
        return false;
      }
    },
    async session({ session, token }) {
      // Get user from database to include latest data
      if (session.user?.email) {
        const user = await db.getUserByEmail(session.user.email);
        if (user) {
          session.user.id = user.id;
          session.user.name = user.name;
          session.user.image = user.avatar_url;
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // Persist user ID in token
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
});
