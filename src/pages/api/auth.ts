import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { json } from '@/lib/http';
import {
  createSessionCookie,
  clearSessionCookie,
  isAuthenticated,
  timingSafeEqual,
} from '@/lib/session';

export const prerender = false;

// Session check: the client uses this on load to confirm the cookie is still
// valid, rather than trusting a stale localStorage flag.
export const GET: APIRoute = async ({ request }) => {
  return json({ authenticated: isAuthenticated(request) });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { password } = await request.json();
    const adminPassword = getSecret('ADMIN_PASSWORD');

    if (!adminPassword) {
      return json({ error: 'Admin password not configured on server' }, 500);
    }

    if (typeof password === 'string' && timingSafeEqual(password, adminPassword)) {
      const cookie = createSessionCookie();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie && { 'Set-Cookie': cookie }),
        },
      });
    }

    return json({ error: 'Invalid password' }, 401);
  } catch {
    return json({ error: 'Authentication failed' }, 500);
  }
};

// Logout: clear the session cookie.
export const DELETE: APIRoute = async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  });
};
