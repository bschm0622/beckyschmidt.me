import type { APIRoute } from 'astro';
import { ingest } from '@/lib/analytics/ingest';
import type { Beacon } from '@/lib/analytics/track';

export const prerender = false;

// Collector endpoint for src/lib/analytics/collector.ts. Always 204, so a bad beacon tells nobody anything.
export const POST: APIRoute = async ({ request, url }) => {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return new Response(null, { status: 204 });

  let beacon: Beacon;
  try {
    const body = await request.text();
    if (body.length > 4096) return new Response(null, { status: 204 });
    beacon = JSON.parse(body);
  } catch {
    return new Response(null, { status: 204 });
  }

  try {
    await ingest(request, beacon);
  } catch (error) {
    console.error('Analytics beacon failed:', error);
  }
  return new Response(null, { status: 204 });
};
