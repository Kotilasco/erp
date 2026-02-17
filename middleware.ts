import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  // Logging enabled for all authenticated users to populate Audit Logs
  if (req.auth?.user?.id) {
    const { pathname, search } = req.nextUrl;
    const method = req.method;
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    fetch(`${req.nextUrl.origin}/api/log-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: req.auth.user.id,
        action: `${method} ${pathname}`,
        method,
        path: pathname + search,
        ip,
        userAgent,
      }),
    }).catch(() => { });
  }
});

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
