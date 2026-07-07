import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { getSecret } from 'astro:env/server';
import { createSessionCookie, clearSessionCookie } from '@/lib/session';

export const prerender = false;

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { password } = await request.json();
    const adminPassword = getSecret('ADMIN_PASSWORD');

    if (!adminPassword) {
      return new Response(
        JSON.stringify({ error: 'Admin password not configured on server' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
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

    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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
