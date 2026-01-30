import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      console.log(`[Auth] Sign-in attempt: ${user.email}`);
      // If no allowed emails configured, allow all
      if (ALLOWED_EMAILS.length === 0) return true;
      // Check if email is in whitelist
      const allowed = ALLOWED_EMAILS.includes(user.email?.toLowerCase() || '');
      console.log(`[Auth] ${user.email} - ${allowed ? 'ALLOWED' : 'DENIED'}`);
      return allowed;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
