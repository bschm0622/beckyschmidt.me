import crypto from 'node:crypto';
import { getSecret } from 'astro:env/server';

const COOKIE_NAME = 'admin_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours, in seconds

// `Secure` cookies are dropped over plain HTTP (except on localhost), which
// breaks testing the dev server from another device over the LAN. Production
// runs on HTTPS behind Cloudflare, so keep it strict there and relax it only
// in dev.
const SECURE = import.meta.env.PROD ? ' Secure;' : '';

/**
 * Session tokens are `<expiry>.<hmac>`, signed with ADMIN_PASSWORD as the key.
 * No database needed: the signature both authenticates the session and is
 * unforgeable without the server-side password.
 */
function sign(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

/** Set-Cookie value establishing an authenticated session, or null if unconfigured. */
export function createSessionCookie(): string | null {
  const secret = getSecret('ADMIN_PASSWORD');
  if (!secret) return null;
  const exp = String(Date.now() + MAX_AGE * 1000);
  const token = `${exp}.${sign(exp, secret)}`;
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly;${SECURE} SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

/** Set-Cookie value that clears the session (for logout). */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly;${SECURE} SameSite=Strict; Path=/; Max-Age=0`;
}

export function isAuthenticated(request: Request): boolean {
  const secret = getSecret('ADMIN_PASSWORD');
  if (!secret) return false;

  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;

  const [exp, sig] = decodeURIComponent(match[1]).split('.');
  if (!exp || !sig) return false;

  const expected = sign(exp, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  return Number(exp) > Date.now();
}

/**
 * Guard for protected API routes. Returns a 401 Response if the request is
 * not authenticated, or `null` to proceed.
 */
export function requireAuth(request: Request): Response | null {
  if (isAuthenticated(request)) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
