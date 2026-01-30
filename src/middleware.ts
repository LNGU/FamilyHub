import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

export const config = {
  matcher: [
    // Protect all routes except auth, api/auth, PWA files, and Next.js internals
    '/((?!auth|api/auth|manifest.json|sw.js|icon-.*|_next/static|_next/image|favicon.ico).*)',
  ],
};
