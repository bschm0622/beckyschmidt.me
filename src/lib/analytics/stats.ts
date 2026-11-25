// Server-only: read side of the analytics, for the colophon chart, /admin and /admin/analytics.
import { env } from "cloudflare:workers";
import { lastDays, siteDay, siteHour } from "@/lib/analytics/day";
import type { Dashboard } from "@/lib/analytics/dashboards";
import type { EventType } from "@/lib/analytics/track";

/** One bar of the traffic chart: a day, or an hour of today when `hour` is set. */
export interface DayTraffic {
    day: string;
    hour?: number;
    views: number;
    visitors: number;
}

export interface Row {
    label: string;
    count: number;
    detail?: string;
}

/** A titled list on a dashboard. */
export interface List {
    title: string;
    rows: Row[];
    empty?: string;
    note?: string;
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
    /** Another site this page view came from, when the visitor came back mid-visit. */
    referrer?: string | null;
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

const query = (db: D1Database) => async <T>(sql: string, ...params: unknown[]): Promise<T[]> =>
    (await db.prepare(sql).bind(...params).all<T>()).results;

/** Views and visitors for each of the last `days` days, zero-filled, oldest first. */
export async function dailyTraffic(days: number, db = env.DB, table = "pageviews"): Promise<DayTraffic[]> {
    const range = lastDays(days);
    const rows = await query(db)<DayTraffic>(
        `SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
         FROM ${table} WHERE day >= ? AND not_found = 0 GROUP BY day`,
        range[0],
    );
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return range.map((day) => byDay.get(day) ?? { day, views: 0, visitors: 0 });
}

/** Today hour by hour, all 24 hours, in the site's time zone. */
export async function hourlyTraffic(db = env.DB, table = "pageviews"): Promise<DayTraffic[]> {
    const day = siteDay(new Date());
    const rows = await query(db)<{ ts: number; visitor: string }>(
        `SELECT ts, visitor FROM ${table} WHERE day = ? AND not_found = 0`,
        day,
    );
    const hours = Array.from({ length: 24 }, (_, hour) => ({ day, hour, views: 0, visitors: new Set<string>() }));
    for (const r of rows) {
        const h = hours[siteHour(r.ts)];
        h.views++;
        h.visitors.add(r.visitor);
    }
    return hours.map((h) => ({ ...h, visitors: h.visitors.size }));
}

/** The chart for a range: hours for Today, days otherwise. */
export const traffic = (days: number, db = env.DB, table = "pageviews") =>
    days === 1 ? hourlyTraffic(db, table) : dailyTraffic(days, db, table);

interface PublicTraffic {
    days: DayTraffic[];
    visitors: number;
}

let publicCache: { at: number; data: PublicTraffic } | null = null;

/** The colophon's 30-day chart, cached per isolate so page loads don't each hit the database. */
export async function publicTraffic(): Promise<PublicTraffic> {
    if (publicCache && Date.now() - publicCache.at < 10 * 60_000) return publicCache.data;
    const since = lastDays(30)[0];
    const [days, visitors] = await Promise.all([
        dailyTraffic(30),
        env.DB.prepare("SELECT COUNT(DISTINCT visitor) AS n FROM pageviews WHERE day >= ? AND not_found = 0")
            .bind(since)
            .first<{ n: number }>(),
    ]);
    publicCache = { at: Date.now(), data: { days, visitors: visitors?.n ?? 0 } };
    return publicCache.data;
}

/** Everything /admin/analytics shows for one site. `days` null means all time. */
export async function report(site: Dashboard, days: number | null) {
    const db = site.db();
    const all = query(db);
    const table = site.table;
    const since = days ? lastDays(days)[0] : "0000-00-00";
    // Interactions count only on page views by people.
    const byPeople = table === "people" ? "AND pageview IN (SELECT id FROM people)" : "";

    const counted = (column: string, limit = 10) =>
        all<Row>(
            `SELECT COALESCE(${column}, 'Unknown') AS label, COUNT(DISTINCT visitor) AS count
             FROM ${table} WHERE day >= ? AND not_found = 0
             GROUP BY label ORDER BY count DESC LIMIT ${limit}`,
            since,
        );
    const events = (type: EventType, limit = 15) =>
        all<Row>(
            `SELECT name AS label, COUNT(*) AS count, MAX(target) AS detail
             FROM events WHERE day >= ? AND type = ? ${byPeople}
             GROUP BY name ORDER BY count DESC LIMIT ${limit}`,
            since,
            type,
        );
    const prefixed = (prefix: string) =>
        all<Row>(
            `SELECT substr(name, ${prefix.length + 1}) AS label, COUNT(*) AS count
             FROM events WHERE day >= ? AND type = 'click' AND substr(name, 1, ${prefix.length}) = ? ${byPeople}
             GROUP BY name ORDER BY count DESC LIMIT 15`,
            since,
            prefix,
        );
    const otherClicks = site.clicks.map((c) => `AND substr(name, 1, ${c.prefix.length}) != '${c.prefix}'`).join(" ");

    const [totals, returning, frequency, daily, pages, referrers, campaigns, cities, countries, devices,
        browsers, systems, languages, outbound, searches, copies, clicks, kinds, notFound, visits] = await Promise.all([
        all<{ views: number; visitors: number; scroll: number | null; engaged: number | null }>(
            `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors,
                    AVG(scroll) AS scroll, AVG(NULLIF(engaged, 0)) AS engaged
             FROM ${table} WHERE day >= ? AND not_found = 0`,
            since,
        ),
        // Visitors in range who had also come on an earlier day (within the same month's hash).
        all<{ n: number }>(
            `SELECT COUNT(DISTINCT p.visitor) AS n FROM ${table} p
             WHERE p.day >= ? AND p.not_found = 0
               AND EXISTS (SELECT 1 FROM ${table} q WHERE q.visitor = p.visitor AND q.day < p.day)`,
            since,
        ),
        all<Row>(
            `SELECT CASE WHEN n = 1 THEN '1 day' WHEN n = 2 THEN '2 days' WHEN n <= 5 THEN '3–5 days' ELSE '6+ days' END
                    AS label, COUNT(*) AS count
             FROM (SELECT visitor, COUNT(DISTINCT day) AS n FROM ${table}
                   WHERE day >= ? AND not_found = 0 GROUP BY visitor)
             GROUP BY label ORDER BY MIN(n)`,
            since,
        ),
        days ? traffic(Math.min(days, 90), db, table) : allTimeDaily(db, table),
        all<PageRow>(
            `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors,
                    ROUND(AVG(scroll)) AS scroll, ROUND(AVG(NULLIF(engaged, 0))) AS engaged
             FROM ${table} WHERE day >= ? AND not_found = 0
             GROUP BY path ORDER BY views DESC LIMIT 30`,
            since,
        ),
        counted("referrer"),
        all<Row>(
            `SELECT utm_source || COALESCE(' / ' || utm_medium, '') AS label, COUNT(DISTINCT visitor) AS count,
                    NULLIF(TRIM(COALESCE(MAX(utm_campaign), '') || ' ' || COALESCE(MAX(utm_content), '') || ' '
                        || COALESCE(MAX(utm_term), '')), '') AS detail
             FROM ${table} WHERE day >= ? AND utm_source IS NOT NULL
             GROUP BY label ORDER BY count DESC LIMIT 10`,
            since,
        ),
        all<Row>(
            `SELECT COALESCE(city, 'Unknown') AS label, COUNT(DISTINCT visitor) AS count,
                    COALESCE(region, '') || '|' || COALESCE(country, '') AS detail
             FROM ${table} WHERE day >= ? AND not_found = 0
             GROUP BY city, region, country ORDER BY count DESC LIMIT 25`,
            since,
        ),
        counted("country"),
        counted("device"),
        counted("browser"),
        counted("os"),
        counted("lang"),
        events("outbound"),
        site.searches ? events("search", 25) : [],
        events("copy"),
        all<Row>(
            `SELECT name AS label, COUNT(*) AS count FROM events
             WHERE day >= ? AND type = 'click' ${otherClicks} ${byPeople}
             GROUP BY name ORDER BY count DESC LIMIT 15`,
            since,
        ),
        Promise.all(site.clicks.map((c) => prefixed(c.prefix))),
        all<Row>(
            `SELECT path AS label, COUNT(*) AS count FROM ${table}
             WHERE day >= ? AND not_found = 1 GROUP BY path ORDER BY count DESC LIMIT 10`,
            since,
        ),
        recentVisits(site, 25, since),
    ]);

    const lists: List[] = [
        { title: "Referrers", rows: referrers.map((r) => (r.label === "Unknown" ? { ...r, label: "Direct" } : r)) },
        {
            title: "Days visited",
            rows: frequency,
            note: "Visitors are recognized within a calendar month, so someone who comes back next month counts as new.",
        },
        ...site.clicks.map((c, i) => ({ title: c.title, rows: kinds[i] })),
        { title: "Outbound clicks", rows: outbound },
        // Search targets are palette ids like "note:/notes/x/"; keep the path.
        ...(site.searches ? [{ title: "Searches", rows: searches.map((r) => ({ ...r, detail: r.detail?.replace(/^\w+:/, "") })) }] : []),
        { title: site.clicks.length ? "Other clicks" : "Clicks", rows: clicks.map((r) => ({ ...r, label: site.clickNames[r.label] ?? r.label })) },
        { title: "Copied text", rows: copies },
        { title: "Campaigns", rows: campaigns, empty: "No UTM-tagged visits." },
        { title: "Countries", rows: countries.map((c) => ({ ...c, label: countryName(c.label === "Unknown" ? null : c.label) })) },
        {
            title: "Cities",
            rows: cities.map((c) => {
                const [region, country] = (c.detail ?? "|").split("|");
                return { ...c, detail: [region, countryName(country || null)].filter(Boolean).join(", ") };
            }),
        },
        { title: "Devices", rows: devices },
        { title: "Browsers", rows: browsers },
        { title: "Operating systems", rows: systems },
        { title: "Languages", rows: languages },
        { title: "Not found", rows: notFound, empty: "No broken links hit." },
    ];

    return {
        totals: { ...totals[0], returning: returning[0]?.n ?? 0 },
        daily,
        pages,
        lists,
        visits,
    };
}

/** All-time chart: every day from the first recorded view to today. */
async function allTimeDaily(db: D1Database, table: string): Promise<DayTraffic[]> {
    const first = await db.prepare(`SELECT MIN(day) AS day FROM ${table}`).first<{ day: string | null }>();
    const today = siteDay(new Date());
    if (!first?.day) return dailyTraffic(30, db, table);
    const span = Math.round((Date.parse(today) - Date.parse(first.day)) / 86_400_000) + 1;
    return dailyTraffic(Math.max(span, 30), db, table);
}

/** The latest `count` visits since `since` (a day), newest first, each with its pages and interactions in order. */
async function recentVisits(site: Dashboard, count: number, since: string): Promise<Visit[]> {
    const all = query(site.db());
    const views = await all<{
        id: string; ts: number; visitor: string; path: string; not_found: number; city: string | null;
        region: string | null; country: string | null; referrer: string | null; device: string | null;
        scroll: number; engaged: number; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
        utm_content: string | null; utm_term: string | null;
    }>(
        `SELECT id, ts, visitor, path, not_found, city, region, country, referrer, device, scroll, engaged,
                utm_source, utm_medium, utm_campaign, utm_content, utm_term
         FROM ${site.table} WHERE day >= ? ORDER BY ts DESC LIMIT 400`,
        since,
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
        // A later page that came from another site means the visitor left and came back.
        const arrived = visit.steps.length > 0 && v.referrer && !v.referrer.endsWith(site.host) ? v.referrer : null;
        visit.steps.push({
            ts: v.ts, kind: v.not_found ? "missing" : "view", path: v.path, scroll: v.scroll, engaged: v.engaged, referrer: arrived,
        });
        for (const e of eventsByView.get(v.id) ?? []) {
            visit.actions++;
            visit.steps.push({ ts: e.ts, kind: e.type, path: v.path, name: e.name, target: e.target });
        }
    }
    const latest = visits.reverse().slice(0, count);

    // Number each visit among all of that visitor's visits this month, not just the ones loaded above.
    const visitors = [...new Set(latest.map((v) => v.visitor))];
    const history = await all<{ visitor: string; ts: number }>(
        `SELECT visitor, ts FROM ${site.table} WHERE visitor IN (${visitors.map(() => "?").join(", ")}) ORDER BY ts`,
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
