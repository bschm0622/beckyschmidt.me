// Server-only: the few numbers /admin/sites shows for each of Becky's sites. Each site keeps its own
// full dashboard; this reads their databases directly and only ever runs SELECTs.
import { env } from "cloudflare:workers";
import { getSecret } from "astro:env/server";
import { lastDays } from "@/lib/analytics/day";
import { SITE } from "@/siteConfig";
import { countryName, traffic, type DayTraffic, type Row } from "@/lib/analytics/stats";
import { searchSummary, type SearchSummary } from "@/lib/analytics/search-console";
import { dashboardFor } from "@/lib/analytics/dashboards";

export interface SiteSummary {
    /** Anchor id for the site's section on /admin. */
    id: string;
    name: string;
    /** Square icon shown beside the name. */
    icon: string;
    /** The site's brand color, for its snapshot's bars on /admin. */
    accent?: string;
    url: string;
    /** The site's own analytics page, when it has one. */
    dashboard?: string;
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
 * The chart's bars from a site's grouped rows, zero-filled: today's 24 hours for Today (rows carry
 * `hour`), otherwise one per day.
 */
function chartBars(days: number, rows: DayTraffic[]): DayTraffic[] {
    if (days === 1) {
        const day = lastDays(1)[0];
        const byHour = new Map(rows.map((r) => [Number(r.hour), r]));
        return Array.from({ length: 24 }, (_, hour) => ({ day, hour, views: byHour.get(hour)?.views ?? 0, visitors: byHour.get(hour)?.visitors ?? 0 }));
    }
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return lastDays(days).map((day) => ({ day, views: byDay.get(day)?.views ?? 0, visitors: byDay.get(day)?.visitors ?? 0 }));
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
        traffic(days, db, table),
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
        accent: dashboardFor("welldesignedsites").accent,
        url: "https://welldesignedsites.com",
        dashboard: "/admin/analytics?site=welldesignedsites",
    };
    const { all, since, ...summary } = await d1Summary(env.WDS_DB, "people", days);
    const start = periods(days).since;
    const [clicks, forms] = await Promise.all([
        all<{ visited: number; opened: number; downloads: number }>(
            `SELECT COALESCE(SUM(name LIKE 'visit:%'), 0) AS visited, COALESCE(SUM(name LIKE 'open:%'), 0) AS opened,
                    COALESCE(SUM(name LIKE 'download:%'), 0) AS downloads
             FROM events WHERE day >= ? AND type = 'click' AND pageview IN (SELECT id FROM people)`,
            since,
        ),
        // Form rows are stamped as UTC text, so compare against the range's start in UTC.
        all<{ suggested: number; advertise: number }>(
            `SELECT COALESCE(SUM(kind = 'submit'), 0) AS suggested, COALESCE(SUM(kind = 'advertise'), 0) AS advertise
             FROM submissions WHERE created_at >= datetime(? / 1000, 'unixepoch')`,
            start,
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

/** CEO Paycheck runs welldesignedsites' tracker; its key action is the organization search. */
async function ceopaycheck(days: number): Promise<Omit<SiteSummary, "search">> {
    const site: Site = {
        id: "ceopaycheck",
        name: "CEO Paycheck",
        icon: "/project-icons/ceopaycheck.svg",
        accent: dashboardFor("ceopaycheck").accent,
        url: "https://ceopaycheck.com",
        dashboard: "/admin/analytics?site=ceopaycheck",
    };
    const { all, since, ...summary } = await d1Summary(env.CP_DB, "people", days);
    // The search records `search:<org>` when a result is opened and `search-miss:<query>` when nothing matches.
    const [e] = await all<{ opened: number; missed: number; outbound: number }>(
        `SELECT COALESCE(SUM(type = 'click' AND name LIKE 'search:%'), 0) AS opened,
                COALESCE(SUM(type = 'click' AND name LIKE 'search-miss:%'), 0) AS missed,
                COALESCE(SUM(type = 'outbound'), 0) AS outbound
         FROM events WHERE day >= ? AND pageview IN (SELECT id FROM people)`,
        since,
    );
    return {
        ...site,
        ...summary,
        conversions: [
            // A search that opened an organization's page; short so it fits the table's conversion column.
            { label: "Lookups", count: e.opened },
            { label: "Searches with no match", count: e.missed },
            { label: "Outbound clicks", count: e.outbound },
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
        accent: "#1f6f4e",
        url: "https://remotepmjobs.com",
        dashboard: "https://analytics.remotepmjobs.com",
    };
    const offset = utcOffsetSeconds();
    const { since, previous } = periods(days);
    const where = "vertical = 'pm' AND is_bot = 0 AND at >= ?";
    const dayOf = (column: string) => `date(${column} / 1000 + ${offset}, 'unixepoch')`;
    const day = dayOf("at");

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
                                AND q.name = 'pageview' AND ${dayOf("q.at")} < ${dayOf("p.at")})`,
            args: [since],
        },
        {
            sql: days === 1
                ? `SELECT CAST(strftime('%H', at / 1000 + ${offset}, 'unixepoch') AS INTEGER) AS hour,
                          COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
                   FROM web_events WHERE ${where} AND name = 'pageview' GROUP BY hour`
                : `SELECT ${day} AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
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

    const c = conversions[0];
    return {
        ...site,
        totals: { ...totals[0], returning: returning[0]?.n ?? 0, engaged: engaged[0]?.seconds ?? null },
        previousVisitors: previousVisitors[0]?.n ?? 0,
        daily: chartBars(days, daily),
        referrers,
        countries: (countries as Row[]).map((r) => ({ ...r, label: countryName(r.label === "Unknown" ? null : r.label) })),
        conversions: [
            { label: "Apply clicks", count: c.applies },
            { label: "Email signups", count: c.signups },
            { label: "Matcher runs", count: c.matches },
        ],
    };
}

/**
 * BiblePlan keeps its analytics in its own Supabase (Postgres) project: `events` has one row per page
 * view or tagged action, with `anon_id` as the visitor (a browser id). Its migrations in the bible-app
 * repo define the table. Read with a read-only Supabase access token through the Management API, which
 * runs one SQL statement and refuses writes.
 */
const BIBLEPLAN_PROJECT = "szpufgqjhqnfsjdkcrba";

async function bibleplan(days: number): Promise<Omit<SiteSummary, "search">> {
    const site: Site = {
        id: "bibleplan",
        name: "BiblePlan",
        icon: "/project-icons/bibleplan.png",
        accent: "#5e82ae",
        url: "https://www.bibleplan.app",
        dashboard: "https://www.bibleplan.app/admin/analytics",
    };
    const { since, previous } = periods(days);
    const tz = SITE.location.timeZone.replace(/'/g, "");
    const at = (ms: number) => `to_timestamp(${Math.floor(ms / 1000)})`;
    const day = (column: string) => `(${column} at time zone '${tz}')::date`;
    // The owner and the end-to-end test account aren't readers.
    const notStaff = (column: string) => `${column} not in (select id from staff)`;
    const top = (rows: string, column: string) => `(select coalesce(json_agg(t), '[]') from (
          select coalesce(${column}, 'Unknown') as label, count(distinct anon_id)::int as count
          from ${rows} group by 1 order by 2 desc limit 5) t)`;

    const query = `
      with staff as (select user_id as id from public.app_admins union all select id from auth.users where email = 'e2e-tests@bibleplan.app'),
      -- Like BiblePlan's own dashboard, drop every browser that has ever been signed in as staff.
      counted as (select * from public.events where (user_id is null or ${notStaff("user_id")})
        and anon_id not in (select anon_id from public.events where anon_id is not null and user_id in (select id from staff))),
      views as (select * from counted where name = 'pageview' and created_at >= ${at(since)}),
      -- Where a visit came from is stored on its first page view only.
      visits as (select distinct on (session_id) anon_id, referrer from views order by session_id, created_at)
      select json_build_object(
        'views', (select count(*)::int from views),
        'visitors', (select count(distinct anon_id)::int from views),
        'returning', (select count(distinct p.anon_id)::int from views p where exists (
          select 1 from public.events q where q.anon_id = p.anon_id and q.name = 'pageview'
            and ${day("q.created_at")} < ${day("p.created_at")})),
        'previousVisitors', (select count(distinct anon_id)::int from counted
          where name = 'pageview' and created_at >= ${at(previous.since)} and created_at < ${at(previous.until)}),
        'daily', (select coalesce(json_agg(d), '[]') from (
          select ${day("created_at")}::text as day,
            ${days === 1 ? `extract(hour from created_at at time zone '${tz}')::int` : "null"} as hour,
            count(*)::int as views, count(distinct anon_id)::int as visitors
          from views group by 1, 2) d),
        'referrers', ${top("visits", "referrer")},
        'countries', ${top("views", "country")},
        'signups', (select count(*)::int from auth.users where created_at >= ${at(since)} and ${notStaff("id")}),
        -- plans.created_at has no time zone; it's UTC.
        'plans', (select count(*)::int from public.plans
          where created_at >= ${at(since)} at time zone 'UTC' and ${notStaff("user_id")}),
        'checked', (select count(*)::int from public.plan_entries e join public.plans p on p.id = e.plan_id
          where e.is_checked and e.checked_at >= ${at(since)} and ${notStaff("p.user_id")}),
        'readers', (select count(distinct user_id)::int from counted
          where created_at >= ${at(since)} and user_id is not null)
      ) as summary`;

    const token = getSecret("BIBLEPLAN_SUPABASE_TOKEN");
    if (!token) throw new Error("BIBLEPLAN_SUPABASE_TOKEN isn't set");
    const response = await fetch(`https://api.supabase.com/v1/projects/${BIBLEPLAN_PROJECT}/database/query/read-only`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error(`supabase http ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const [{ summary: s }] = (await response.json()) as [{ summary: {
        views: number; visitors: number; returning: number; previousVisitors: number;
        daily: DayTraffic[]; referrers: Row[]; countries: Row[];
        signups: number; plans: number; checked: number; readers: number;
    } }];

    return {
        ...site,
        // No time on page: BiblePlan doesn't measure it.
        totals: { views: s.views, visitors: s.visitors, returning: s.returning, engaged: null },
        previousVisitors: s.previousVisitors,
        daily: chartBars(days, s.daily),
        referrers: s.referrers.map((r) => (r.label === "Unknown" ? { ...r, label: "Direct" } : r)),
        countries: s.countries.map((c) => ({ ...c, label: countryName(c.label === "Unknown" ? null : c.label) })),
        conversions: [
            { label: "Sign-ups", count: s.signups },
            { label: "Plans created", count: s.plans },
            { label: "Readings checked off", count: s.checked },
            { label: "Signed-in readers", count: s.readers },
        ],
    };
}

/** Every site's summary for the last `days` days, in the order the page shows them. */
export async function siteSummaries(days: number): Promise<SiteSummary[]> {
    const all = [
        // Shown once its read-only token is set, so a missing token can't break the page.
        ...(getSecret("BIBLEPLAN_SUPABASE_TOKEN") ? [{ summary: bibleplan, host: "bibleplan.app" }] : []),
        { summary: remotepmjobs, host: "remotepmjobs.com" },
        { summary: welldesignedsites, host: "welldesignedsites.com" },
        { summary: ceopaycheck, host: "ceopaycheck.com" },
        { summary: beckyschmidt, host: "beckyschmidt.me" },
    ];
    const sites = all.map(({ summary }) => summary(days));
    const hosts = all.map(({ host }) => host);
    const [traffic, search] = await Promise.all([
        Promise.all(sites),
        Promise.all(hosts.map((host) => searchSummary(host, days))),
    ]);
    return traffic.map((site, i) => ({ ...site, search: search[i] }));
}
