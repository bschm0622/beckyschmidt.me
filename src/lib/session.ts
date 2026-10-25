import crypto from 'node:crypto';
import { getSecret } from 'astro:env/server';
import { json } from '@/lib/http';

const COOKIE_NAME = 'admin_session';
const MAX_AGE = 60 * 60 * 12;

// Secure cookies are dropped over plain HTTP on the LAN, so relax it only in dev.
const SECURE = import.meta.env.PROD ? ' Secure;' : '';

function sign(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function createSessionCookie(): string | null {
  const secret = getSecret('ADMIN_PASSWORD');
  if (!secret) return null;
  const exp = String(Date.now() + MAX_AGE * 1000);
  const token = `${exp}.${sign(exp, secret)}`;
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly;${SECURE} SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

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

  if (!timingSafeEqual(sig, sign(exp, secret))) return false;

  return Number(exp) > Date.now();
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function requireAuth(request: Request): Response | null {
  if (isAuthenticated(request)) return null;
  return json({ error: 'Unauthorized' }, 401);
}
