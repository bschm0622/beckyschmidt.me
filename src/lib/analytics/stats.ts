// Server-only: read side of the analytics, for the colophon chart and /admin/analytics.
import { env } from "cloudflare:workers";
import { lastDays, siteDay } from "@/lib/analytics/day";
import type { EventType } from "@/lib/analytics/track";

export interface DayTraffic {
    day: string;
    views: number;
    visitors: number;
}

export interface Row {
    label: string;
    count: number;
    detail?: string;
}

export interface PageRow {
    path: string;
    views: number;
    visitors: number;
    scroll: number;
    engaged: number;
}

/** One step in a visit: a page view, or an interaction during one. */
export interface VisitStep {
    ts: number;
    kind: "view" | "missing" | EventType;
    path: string;
    name?: string | null;
    target?: string | null;
    scroll?: number;
    engaged?: number;
}

/** Page views by one visitor with under 30 minutes between them, plus what they did on each page. */
export interface Visit {
    start: number;
    place: string;
    referrer: string | null;
    /** UTM tags from the visit's first page, as "source / medium (campaign, content, term)". */
    campaign: string | null;
    /** 1 for this visitor's first visit; visitor hashes reset monthly, so this counts within the month. */
    number: number;
    device: string | null;
    pages: number;
    actions: number;
    steps: VisitStep[];
}

const VISIT_GAP = 30 * 60_000;

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code: string | null): string {
    if (!code || code === "XX" || code === "T1") return "Unknown";
    try {
        return countryNames.of(code) ?? code;
    } catch {
        return code;
    }
}

async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return (await env.DB.prepare(sql).bind(...params).all<T>()).results;
}

/** Views and visitors for each of the last `days` days, zero-filled, oldest first. */
export async function dailyTraffic(days: number): Promise<DayTraffic[]> {
    const range = lastDays(days);
    const rows = await all<DayTraffic>(
        `SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
         FROM pageviews WHERE day >= ? AND not_found = 0 GROUP BY day`,
        range[0],
    );
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return range.map((day) => byDay.get(day) ?? { day, views: 0, visitors: 0 });
}

/** Distinct visitors since `since` (a YYYY-MM-DD day), so a repeat visitor counts once. */
async function visitorsSince(since: string): Promise<number> {
    const row = await env.DB.prepare(
        "SELECT COUNT(DISTINCT visitor) AS n FROM pageviews WHERE day >= ? AND not_found = 0",
    ).bind(since).first<{ n: number }>();
    return row?.n ?? 0;
}

interface PublicTraffic {
    days: DayTraffic[];
    visitors: number;
}

let publicCache: { at: number; data: PublicTraffic } | null = null;

/** The colophon's 30-day chart, cached per isolate so page loads don't each hit the database. */
export async function publicTraffic(): Promise<PublicTraffic> {
    if (publicCache && Date.now() - publicCache.at < 10 * 60_000) return publicCache.data;
    const [days, visitors] = await Promise.all([dailyTraffic(30), visitorsSince(lastDays(30)[0])]);
    publicCache = { at: Date.now(), data: { days, visitors } };
    return publicCache.data;
}

/** Everything /admin/analytics shows. `days` null means all time. */
export async function report(days: number | null) {
    const since = days ? lastDays(days)[0] : "0000-00-00";
    const counted = (column: string, limit = 10) =>
        all<Row>(
            `SELECT COALESCE(${column}, 'Unknown') AS label, COUNT(DISTINCT visitor) AS count
             FROM pageviews WHERE day >= ? AND not_found = 0
             GROUP BY label ORDER BY count DESC LIMIT ${limit}`,
            since,
        );
    const events = (type: string, limit = 15) =>
        all<Row>(
            `SELECT name AS label, COUNT(*) AS count, MAX(target) AS detail
             FROM events WHERE day >= ? AND type = ?
             GROUP BY name ORDER BY count DESC LIMIT ${limit}`,
            since,
            type,
        );

    const [totals, returning, frequency, daily, pages, referrers, campaigns, cities, countries, devices, browsers,
        systems, languages, outbound, searches, copies, clicks, notFound, visits] = await Promise.all([
        all<{ views: number; visitors: number; scroll: number | null; engaged: number | null }>(
            `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors,
                    AVG(scroll) AS scroll, AVG(NULLIF(engaged, 0)) AS engaged
             FROM pageviews WHERE day >= ? AND not_found = 0`,
            since,
        ),
        // Visitors in range who had also come on an earlier day (within the same month's hash).
        all<{ n: number }>(
            `SELECT COUNT(DISTINCT p.visitor) AS n FROM pageviews p
             WHERE p.day >= ? AND p.not_found = 0
               AND EXISTS (SELECT 1 FROM pageviews q WHERE q.visitor = p.visitor AND q.day < p.day)`,
            since,
        ),
        all<Row>(
            `SELECT CASE WHEN n = 1 THEN '1 day' WHEN n = 2 THEN '2 days' WHEN n <= 5 THEN '3–5 days' ELSE '6+ days' END
                    AS label, COUNT(*) AS count
             FROM (SELECT visitor, COUNT(DISTINCT day) AS n FROM pageviews
                   WHERE day >= ? AND not_found = 0 GROUP BY visitor)
             GROUP BY label ORDER BY MIN(n)`,
            since,
        ),
        days ? dailyTraffic(Math.min(days, 90)) : allTimeDaily(),
        all<PageRow>(
            `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors,
                    ROUND(AVG(scroll)) AS scroll, ROUND(AVG(NULLIF(engaged, 0))) AS engaged
             FROM pageviews WHERE day >= ? AND not_found = 0
             GROUP BY path ORDER BY views DESC LIMIT 30`,
            since,
        ),
        counted("referrer"),
        all<Row>(
            `SELECT utm_source || COALESCE(' / ' || utm_medium, '') AS label, COUNT(DISTINCT visitor) AS count,
                    MAX(utm_campaign) AS detail
             FROM pageviews WHERE day >= ? AND utm_source IS NOT NULL
             GROUP BY label ORDER BY count DESC LIMIT 10`,
            since,
        ),
        all<Row>(
            `SELECT COALESCE(city, 'Unknown') AS label, COUNT(DISTINCT visitor) AS count,
                    COALESCE(region, '') || '|' || COALESCE(country, '') AS detail
             FROM pageviews WHERE day >= ? AND not_found = 0
             GROUP BY city, region, country ORDER BY count DESC LIMIT 25`,
            since,
        ),
        counted("country"),
        counted("device"),
        counted("browser"),
        counted("os"),
        counted("lang"),
        events("outbound"),
        events("search", 25),
        events("copy"),
        events("click"),
        all<Row>(
            `SELECT path AS label, COUNT(*) AS count FROM pageviews
             WHERE day >= ? AND not_found = 1 GROUP BY path ORDER BY count DESC LIMIT 10`,
            since,
        ),
        recentVisits(25),
    ]);

    return {
        totals: { ...totals[0], returning: returning[0]?.n ?? 0 },
        frequency,
        daily,
        pages,
        referrers: referrers.map((r) => (r.label === "Unknown" ? { ...r, label: "Direct" } : r)),
        campaigns,
        cities: cities.map((c) => {
            const [region, country] = (c.detail ?? "|").split("|");
            return { ...c, detail: [region, countryName(country || null)].filter(Boolean).join(", ") };
        }),
        countries: countries.map((c) => ({ ...c, label: countryName(c.label === "Unknown" ? null : c.label) })),
        devices,
        browsers,
        systems,
        languages,
        outbound,
        // Search targets are palette ids like "note:/notes/x/"; keep the path.
        searches: searches.map((r) => ({ ...r, detail: r.detail?.replace(/^\w+:/, "") })),
        copies,
        clicks,
        notFound,
        visits,
    };
}

/** All-time chart: every day from the first recorded view to today. */
async function allTimeDaily(): Promise<DayTraffic[]> {
    const first = await env.DB.prepare("SELECT MIN(day) AS day FROM pageviews").first<{ day: string | null }>();
    const today = siteDay(new Date());
    if (!first?.day) return dailyTraffic(30);
    const span = Math.round((Date.parse(today) - Date.parse(first.day)) / 86_400_000) + 1;
    return dailyTraffic(Math.max(span, 30));
}

/** The latest `count` visits, newest first, each with its pages and interactions in order. */
async function recentVisits(count: number): Promise<Visit[]> {
    const views = await all<{
        id: string; ts: number; visitor: string; path: string; not_found: number; city: string | null;
        region: string | null; country: string | null; referrer: string | null; device: string | null;
        scroll: number; engaged: number; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
        utm_content: string | null; utm_term: string | null;
    }>(
        `SELECT id, ts, visitor, path, not_found, city, region, country, referrer, device, scroll, engaged,
                utm_source, utm_medium, utm_campaign, utm_content, utm_term
         FROM pageviews ORDER BY ts DESC LIMIT 400`,
    );
    if (views.length === 0) return [];
    const events = await all<{ ts: number; pageview: string; type: EventType; name: string; target: string | null }>(
        "SELECT ts, pageview, type, name, target FROM events WHERE ts >= ? ORDER BY ts",
        views[views.length - 1].ts,
    );
    const eventsByView = Map.groupBy(events, (e) => e.pageview);

    // Oldest first, so each visitor's views can be split wherever the gap runs past 30 minutes.
    const open = new Map<string, { last: number; visit: Visit }>();
    const visits: (Visit & { visitor: string })[] = [];
    for (const v of views.toReversed()) {
        let current = open.get(v.visitor);
        if (!current || v.ts - current.last > VISIT_GAP) {
            const tags = [v.utm_campaign, v.utm_content, v.utm_term].filter(Boolean).join(", ");
            const visit = {
                visitor: v.visitor,
                start: v.ts,
                place: [v.city, v.region, v.country && countryName(v.country)].filter(Boolean).join(", ") || "Unknown place",
                referrer: v.referrer,
                campaign: v.utm_source
                    ? `${v.utm_source}${v.utm_medium ? ` / ${v.utm_medium}` : ""}${tags ? ` (${tags})` : ""}`
                    : null,
                number: 1,
                device: v.device,
                pages: 0,
                actions: 0,
                steps: [],
            };
            current = { last: v.ts, visit };
            open.set(v.visitor, current);
            visits.push(visit);
        }
        current.last = v.ts;
        const { visit } = current;
        visit.pages++;
        visit.steps.push({ ts: v.ts, kind: v.not_found ? "missing" : "view", path: v.path, scroll: v.scroll, engaged: v.engaged });
        for (const e of eventsByView.get(v.id) ?? []) {
            visit.actions++;
            visit.steps.push({ ts: e.ts, kind: e.type, path: v.path, name: e.name, target: e.target });
        }
    }
    const latest = visits.reverse().slice(0, count);

    // Number each visit among all of that visitor's visits this month, not just the ones loaded above.
    const visitors = [...new Set(latest.map((v) => v.visitor))];
    const history = await all<{ visitor: string; ts: number }>(
        `SELECT visitor, ts FROM pageviews WHERE visitor IN (${visitors.map(() => "?").join(", ")}) ORDER BY ts`,
        ...visitors,
    );
    const starts = new Map<string, number[]>();
    for (const [visitor, rows] of Map.groupBy(history, (h) => h.visitor)) {
        starts.set(visitor, rows.filter((r, i) => i === 0 || r.ts - rows[i - 1].ts > VISIT_GAP).map((r) => r.ts));
    }
    return latest.map(({ visitor, ...visit }) => ({
        ...visit,
        number: (starts.get(visitor) ?? []).filter((ts) => ts <= visit.start).length || 1,
    }));
}

