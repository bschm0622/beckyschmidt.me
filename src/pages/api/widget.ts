import type { APIRoute } from 'astro';
import { json } from '@/lib/http';
import { hasWidgetKey } from '@/lib/session';
import { siteSummaries } from '@/lib/analytics/sites';

export const prerender = false;

const RANGES = { today: { label: 'Today', days: 1 }, '7d': { label: 'Last 7 days', days: 7 } } as const;

/** Scriptable can't draw SVG, so the widget gets each icon's PNG copy. */
const pngIcon = (icon: string) => (icon === '/favicon.svg' ? '/favicon-96x96.png' : icon.replace(/\.svg$/, '.png'));

/**
 * The phone widget's numbers (the Scriptable script from /admin/widget): the Overview's table for Today or
 * the last 7 days, plus each site's visitors per hour (Today) or per day for its little bar chart.
 */
export const GET: APIRoute = async ({ request, url }) => {
  if (!hasWidgetKey(request)) return json({ error: 'Unauthorized' }, 401);
  const key = url.searchParams.get('range') === '7d' ? '7d' : 'today';
  const range = RANGES[key];

  try {
    const sites = await siteSummaries(range.days, { search: false });
    return json({
      range: key,
      label: range.label,
      sites: sites.map((site) => {
        const [goal] = site.conversions;
        return {
          id: site.id,
          name: site.name,
          icon: new URL(pngIcon(site.icon), url).href,
          accent: site.accent ?? null,
          visitors: site.totals.visitors,
          change: site.previousVisitors
            ? Math.round(((site.totals.visitors - site.previousVisitors) / site.previousVisitors) * 100)
            : null,
          // "1 sign-up", not "1 sign-ups": every plural label here ends in a plain s.
          goal: goal
            ? `${goal.count.toLocaleString('en-US')} ${goal.label.toLowerCase().replace(goal.count === 1 ? /s$/ : /$^/, '')}`
            : null,
          bars: site.daily.map((d) => d.visitors),
        };
      }),
    });
  } catch (error) {
    console.error('Widget data failed:', error);
    return json({ error: 'Could not load the numbers' }, 502);
  }
};
