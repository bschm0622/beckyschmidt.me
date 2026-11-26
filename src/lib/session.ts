import crypto from 'node:crypto';
import { getSecret } from 'astro:env/server';
import { json } from '@/lib/http';

const COOKIE_NAME = 'admin_session';
// 30 days: this is Becky's own browser, and the cookie is HttpOnly, Secure and SameSite=Lax (Strict drops it when the site is opened from a link in another app).
const MAX_AGE = 60 * 60 * 24 * 30;

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
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly;${SECURE} SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly;${SECURE} SameSite=Lax; Path=/; Max-Age=0`;
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

/**
 * The key the phone widget (Scriptable) sends as a bearer token to /api/widget. It's derived from the
 * admin password, so changing the password changes the key; /admin/widget hands it out baked into the script.
 */
export function widgetKey(): string | null {
  const secret = getSecret('ADMIN_PASSWORD');
  return secret ? sign('widget', secret) : null;
}

export function hasWidgetKey(request: Request): boolean {
  const key = widgetKey();
  const sent = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return Boolean(key && sent && timingSafeEqual(sent, key));
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
