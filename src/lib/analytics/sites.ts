// Server-only: the few numbers /admin/sites shows for each of Becky's sites. Each site keeps its own
// full dashboard; this reads their databases directly and only ever runs SELECTs.
import { env } from "cloudflare:workers";
import { getSecret } from "astro:env/server";
import { lastDays } from "@/lib/analytics/day";
import { SITE } from "@/siteConfig";
import { countryName, dailyTraffic, type DayTraffic, type Row } from "@/lib/analytics/stats";
import { searchSummary, type SearchSummary } from "@/lib/analytics/search-console";

export interface SiteSummary {
    /** Anchor id for the site's section on /admin. */
    id: string;
    name: string;
    /** Square icon shown beside the name. */
    icon: string;
    url: string;
    dashboard: string;
    totals: { views: number; visitors: number; returning: number; engaged: number | null };
    /** Visitors in the same span just before this one (for Today: yesterday up to this time). */
    previousVisitors: number;
    daily: DayTraffic[];
    referrers: Row[];
    countries: Row[];
    conversions: Row[];
    /** Google Search Console; null when no service account key is configured. */
    search: SearchSummary | null;
}

type Site = Omit<SiteSummary, "totals" | "previousVisitors" | "daily" | "referrers" | "countries" | "conversions" | "search">;

/**
 * The range as ms timestamps: from midnight (site time) on its first day to now, plus the same span
 * just before it, ending at this time of day `days` days ago.
 */
function periods(days: number) {
    const now = Date.now();
    const since = Date.parse(`${lastDays(days)[0]}T00:00:00Z`) - utcOffsetSeconds() * 1000;
    const shift = days * 86_400_000;
    return { since, previous: { since: since - shift, until: now - shift } };
}

/**
 * Totals, chart and top lists for a site on the shared pageviews schema (this site and welldesignedsites).
 * `table` is what counts as a person: welldesignedsites keeps bots in `pageviews` and filters them
 * through its `people` view, while this site drops bots before they're stored.
 */
async function d1Summary(db: D1Database, table: "pageviews" | "people", days: number) {
    const since = lastDays(days)[0];
    const all = async <T>(sql: string, ...params: unknown[]) => (await db.prepare(sql).bind(...params).all<T>()).results;
    const top = (column: string) =>
        all<Row>(
            `SELECT COALESCE(${column}, 'Unknown') AS label, COUNT(DISTINCT visitor) AS count
             FROM ${table} WHERE day >= ? AND not_found = 0
             GROUP BY label ORDER BY count DESC LIMIT 5`,
            since,
        );

    const { previous } = periods(days);
    const [totals, returning, previousVisitors, daily, referrers, countries] = await Promise.all([
        all<{ views: number; visitors: number; engaged: number | null }>(
            `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, AVG(NULLIF(engaged, 0)) AS engaged
             FROM ${table} WHERE day >= ? AND not_found = 0`,
            since,
        ),
        all<{ n: number }>(
            `SELECT COUNT(DISTINCT p.visitor) AS n FROM ${table} p
             WHERE p.day >= ? AND p.not_found = 0
               AND EXISTS (SELECT 1 FROM ${table} q WHERE q.visitor = p.visitor AND q.day < p.day)`,
            since,
        ),
        all<{ n: number }>(
            `SELECT COUNT(DISTINCT visitor) AS n FROM ${table} WHERE ts >= ? AND ts < ? AND not_found = 0`,
            previous.since,
            previous.until,
        ),
        dailyTraffic(days, db, table),
        top("referrer"),
        top("country"),
    ]);

    return {
        totals: { ...totals[0], returning: returning[0]?.n ?? 0 },
        previousVisitors: previousVisitors[0]?.n ?? 0,
        daily,
        referrers: referrers.map((r) => (r.label === "Unknown" ? { ...r, label: "Direct" } : r)),
        countries: countries.map((c) => ({ ...c, label: countryName(c.label === "Unknown" ? null : c.label) })),
        all,
        since,
    };
}

/** Share of the period's visitors, as the row's detail. */
const ofVisitors = (rows: Row[], visitors: number) =>
    rows.map((r) => ({ ...r, detail: visitors ? `${Math.round((r.count / visitors) * 100)}% of visitors` : undefined }));

async function welldesignedsites(days: number): Promise<Omit<SiteSummary, "search">> {
    const site: Site = {
        id: "welldesignedsites",
        name: "Well Designed Sites",
        icon: "/project-icons/welldesignedsites.svg",
        url: "https://welldesignedsites.com",
        dashboard: "https://welldesignedsites.com/admin",
    };
    const { all, since, ...summary } = await d1Summary(env.WDS_DB, "people", days);
    const [clicks, forms] = await Promise.all([
        all<{ visited: number; opened: number; downloads: number }>(
            `SELECT COALESCE(SUM(name LIKE 'visit:%'), 0) AS visited, COALESCE(SUM(name LIKE 'open:%'), 0) AS opened,
                    COALESCE(SUM(name LIKE 'download:%'), 0) AS downloads
             FROM events WHERE day >= ? AND type = 'click' AND pageview IN (SELECT id FROM people)`,
            since,
        ),
        // Form rows are stamped in UTC, so the window edge can be a few hours off the site's day.
        all<{ suggested: number; advertise: number }>(
            `SELECT COALESCE(SUM(kind = 'submit'), 0) AS suggested, COALESCE(SUM(kind = 'advertise'), 0) AS advertise
             FROM submissions WHERE created_at >= datetime('now', ?)`,
            `-${days} days`,
        ),
    ]);
    const c = clicks[0];
    const f = forms[0];
    return {
        ...site,
        ...summary,
        conversions: [
            { label: "Visit site clicks", count: c.visited },
            { label: "Sites opened", count: c.opened },
            { label: "Screenshot downloads", count: c.downloads },
            { label: "Sites suggested", count: f.suggested },
            { label: "Advertising inquiries", count: f.advertise },
        ],
    };
}

async function beckyschmidt(days: number): Promise<Omit<SiteSummary, "search">> {
    const site: Site = {
        id: "beckyschmidt",
        name: "Personal site",
        icon: "/favicon.svg",
        url: "https://beckyschmidt.me",
        dashboard: "/admin/analytics",
    };
    const { all, since, ...summary } = await d1Summary(env.DB, "pageviews", days);
    // Notes are /notes/<id>/; the notes index and tag pages don't count.
    const [notes] = await all<{ opened: number; read: number }>(
        `SELECT COUNT(DISTINCT visitor) AS opened, COUNT(DISTINCT CASE WHEN engaged >= 30 THEN visitor END) AS read
         FROM pageviews WHERE day >= ? AND not_found = 0 AND path GLOB '/notes/?*/' AND path NOT GLOB '/notes/tag/*'`,
        since,
    );
    return {
        ...site,
        ...summary,
        conversions: ofVisitors(
            [
                { label: "Opened a note", count: notes.opened },
                { label: "Read one for 30s+", count: notes.read },
            ],
            summary.totals.visitors,
        ),
    };
}

type TursoValue = { type: string; value?: string };

/** Runs read-only statements against remotepmjobs' Turso database over its HTTP API. */
async function turso<T>(statements: { sql: string; args: (string | number)[] }[]): Promise<T[][]> {
    const url = getSecret("RPJ_TURSO_URL");
    const token = getSecret("RPJ_TURSO_TOKEN");
    if (!url || !token) throw new Error("RPJ_TURSO_URL / RPJ_TURSO_TOKEN aren't set");
    const response = await fetch(`${url.replace(/^libsql:/, "https:")}/v2/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            requests: [
                ...statements.map(({ sql, args }) => ({
                    type: "execute",
                    stmt: {
                        sql,
                        args: args.map((a) =>
                            typeof a === "number" ? { type: "integer", value: String(a) } : { type: "text", value: a },
                        ),
                    },
                })),
                { type: "close" },
            ],
        }),
    });
    if (!response.ok) throw new Error(`turso http ${response.status}`);
    // A failed statement still comes back as HTTP 200, with an error entry in its slot.
    const { results } = (await response.json()) as {
        results: { type: string; error?: { message?: string }; response?: { result?: { cols: { name: string }[]; rows: TursoValue[][] } } }[];
    };
    return results.slice(0, statements.length).map((r) => {
        if (r.type !== "ok" || !r.response?.result) throw new Error(`turso: ${r.error?.message ?? "no result"}`);
        const { cols, rows } = r.response.result;
        return rows.map((row) =>
            Object.fromEntries(row.map((v, i) => [
                cols[i].name,
                v.type === "integer" || v.type === "float" ? Number(v.value) : (v.value ?? null),
            ])) as T,
        );
    });
}

/** The site's UTC offset right now, in seconds, so Turso's UTC timestamps bucket into Becky's days. */
function utcOffsetSeconds(): number {
    const now = new Date();
    const wall = new Date(now.toLocaleString("en-US", { timeZone: SITE.location.timeZone }));
    return Math.round((wall.getTime() - now.getTime()) / 60_000) * 60;
}

/**
 * remotepmjobs keeps everything in one `web_events` table: a page view is an event named "pageview".
 * Bots are flagged, not dropped, and a page reached from another page on the site counts as channel
 * "internal", which isn't a referrer. Its own dashboard and lib/analytics-sql.ts there define all this.
 * Its visitor hash reset daily until 2026-12-01 and monthly after, so visitors and returning visitors
 * are only comparable with the other sites from December on.
 */
async function remotepmjobs(days: number): Promise<Omit<SiteSummary, "search">> {
    const site: Site = {
        id: "remotepmjobs",
        name: "Remote PM Jobs",
        icon: "/project-icons/remotepmjobs.png",
        url: "https://remotepmjobs.com",
        dashboard: "https://analytics.remotepmjobs.com",
    };
    const range = lastDays(days);
    const offset = utcOffsetSeconds();
    const { since, previous } = periods(days);
    const where = "vertical = 'pm' AND is_bot = 0 AND at >= ?";
    const day = `date(at / 1000 + ${offset}, 'unixepoch')`;

    const [totals, previousVisitors, engaged, returning, daily, referrers, countries, conversions] = await turso<any>([
        {
            sql: `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
                  FROM web_events WHERE ${where} AND name = 'pageview'`,
            args: [since],
        },
        {
            sql: `SELECT COUNT(DISTINCT visitor_hash) AS n FROM web_events
                  WHERE vertical = 'pm' AND is_bot = 0 AND name = 'pageview' AND at >= ? AND at < ?`,
            args: [previous.since, previous.until],
        },
        // An "engagement" row reports a page view's visible seconds so far, and a page view can send
        // several (once per time the tab is hidden), so take the largest per page view (`pv`).
        {
            sql: `SELECT AVG(seconds) AS seconds FROM (
                    SELECT MAX(json_extract(props, '$.seconds')) AS seconds FROM web_events
                    WHERE ${where} AND name = 'engagement' AND json_extract(props, '$.pv') IS NOT NULL
                    GROUP BY json_extract(props, '$.pv'))`,
            args: [since],
        },
        {
            sql: `SELECT COUNT(DISTINCT p.visitor_hash) AS n FROM web_events p
                  WHERE p.vertical = 'pm' AND p.is_bot = 0 AND p.at >= ? AND p.name = 'pageview'
                    AND EXISTS (SELECT 1 FROM web_events q WHERE q.visitor_hash = p.visitor_hash
                                AND q.name = 'pageview' AND date(q.at / 1000, 'unixepoch') < date(p.at / 1000, 'unixepoch'))`,
            args: [since],
        },
        {
            sql: `SELECT ${day} AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
                  FROM web_events WHERE ${where} AND name = 'pageview' GROUP BY day`,
            args: [since],
        },
        {
            sql: `SELECT COALESCE(referrer_host, 'Direct') AS label, COUNT(DISTINCT visitor_hash) AS count
                  FROM web_events WHERE ${where} AND name = 'pageview' AND channel != 'internal'
                  GROUP BY label ORDER BY count DESC LIMIT 5`,
            args: [since],
        },
        {
            sql: `SELECT COALESCE(country, 'Unknown') AS label, COUNT(DISTINCT visitor_hash) AS count
                  FROM web_events WHERE ${where} AND name = 'pageview'
                  GROUP BY label ORDER BY count DESC LIMIT 5`,
            args: [since],
        },
        // email_signup fires only once the subscribe API confirmed the row, so it counts real signups.
        {
            sql: `SELECT COALESCE(SUM(name = 'email_signup'), 0) AS signups, COALESCE(SUM(name = 'apply_click'), 0) AS applies,
                         COALESCE(SUM(name = 'match_analyze'), 0) AS matches
                  FROM web_events WHERE ${where}`,
            args: [since],
        },
    ]);

    const byDay = new Map((daily as DayTraffic[]).map((d) => [d.day, d]));
    const c = conversions[0];
    return {
        ...site,
        totals: { ...totals[0], returning: returning[0]?.n ?? 0, engaged: engaged[0]?.seconds ?? null },
        previousVisitors: previousVisitors[0]?.n ?? 0,
        daily: range.map((d) => byDay.get(d) ?? { day: d, views: 0, visitors: 0 }),
        referrers,
        countries: (countries as Row[]).map((r) => ({ ...r, label: countryName(r.label === "Unknown" ? null : r.label) })),
        conversions: [
            { label: "Apply clicks", count: c.applies },
            { label: "Email signups", count: c.signups },
            { label: "Matcher runs", count: c.matches },
        ],
    };
}

/** Every site's summary for the last `days` days, in the order the page shows them. */
export async function siteSummaries(days: number): Promise<SiteSummary[]> {
    const sites = [remotepmjobs, welldesignedsites, beckyschmidt].map((summary) => summary(days));
    const hosts = ["remotepmjobs.com", "welldesignedsites.com", "beckyschmidt.me"];
    const [traffic, search] = await Promise.all([
        Promise.all(sites),
        Promise.all(hosts.map((host) => searchSummary(host, days))),
    ]);
    return traffic.map((site, i) => ({ ...site, search: search[i] }));
}
