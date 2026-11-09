// Server-only: turns collector beacons into rows. No cookies and no stored IPs; a visitor is a hash
// of IP + user agent + a random salt that's deleted when the month ends (Umami's default rotation), so
// repeat visits within a month can be counted but nobody can be followed from one month to the next.
import { env } from "cloudflare:workers";
import { isbot } from "isbot";
import { isAuthenticated } from "@/lib/session";
import { siteDay } from "@/lib/analytics/day";
import type { Beacon, EventType } from "@/lib/analytics/track";

const EVENT_TYPES: EventType[] = ["outbound", "search", "copy", "click"];
const MAX_ENGAGED = 4 * 60 * 60;

interface CfProps {
    country?: string;
    region?: string;
    city?: string;
}

let saltCache: { period: string; salt: string } | null = null;

/** This month's salt (period is YYYY-MM); older ones are deleted. */
async function getSalt(period: string): Promise<string> {
    if (saltCache?.period === period) return saltCache.salt;
    await env.DB.batch([
        env.DB.prepare("INSERT OR IGNORE INTO salts (period, salt) VALUES (?, ?)").bind(period, crypto.randomUUID()),
        env.DB.prepare("DELETE FROM salts WHERE period <> ?").bind(period),
    ]);
    const row = await env.DB.prepare("SELECT salt FROM salts WHERE period = ?").bind(period).first<{ salt: string }>();
    saltCache = { period, salt: row!.salt };
    return saltCache.salt;
}

async function visitorHash(salt: string, ip: string, ua: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${ip}|${ua}`));
    return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseUserAgent(ua: string, touch: boolean) {
    let os = /iPhone|iPad|iPod/.test(ua) ? "iOS"
        : /Android/.test(ua) ? "Android"
        : /CrOS/.test(ua) ? "ChromeOS"
        : /Macintosh|Mac OS X/.test(ua) ? "macOS"
        : /Windows/.test(ua) ? "Windows"
        : /Linux/.test(ua) ? "Linux"
        : "Other";
    const browser = /Edg\//.test(ua) ? "Edge"
        : /OPR\/|Opera/.test(ua) ? "Opera"
        : /SamsungBrowser/.test(ua) ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua) ? "Firefox"
        : /Chrome\/|CriOS/.test(ua) ? "Chrome"
        : /Safari\//.test(ua) ? "Safari"
        : "Other";
    let device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet"
        : /Mobi|iPhone|Android/.test(ua) ? "mobile"
        : "desktop";
    // iPadOS reports itself as a Mac; a touchscreen gives it away.
    if (os === "macOS" && touch) {
        os = "iOS";
        device = "tablet";
    }
    return { os, browser, device };
}

const str = (v: unknown, max: number): string | null =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

const num = (v: unknown, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 0), max) : 0;

function referrerHost(referrer: unknown, ownHost: string): string | null {
    const raw = str(referrer, 500);
    if (!raw) return null;
    try {
        const host = new URL(raw).hostname.replace(/^www\./, "");
        return host && host !== ownHost.replace(/^www\./, "") ? host : null;
    } catch {
        return null;
    }
}

/** Records one beacon. Returns false when it was ignored (bot, the site owner, bad input). */
export async function ingest(request: Request, beacon: Beacon): Promise<boolean> {
    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || isbot(ua) || isAuthenticated(request)) return false;

    const path = str(beacon.p, 300);
    const id = str(beacon.id, 64);
    if (!id || (beacon.t !== "eng" && !path?.startsWith("/"))) return false;

    const now = Date.now();
    const day = siteDay(new Date(now));
    const ip = request.headers.get("cf-connecting-ip") ?? "";
    const visitor = await visitorHash(await getSalt(day.slice(0, 7)), ip, ua);

    if (beacon.t === "pv") {
        const cf = ((request as Request & { cf?: CfProps }).cf ?? {}) as CfProps;
        const { os, browser, device } = parseUserAgent(ua, beacon.tp === 1);
        await env.DB.prepare(
            `INSERT OR IGNORE INTO pageviews
             (id, ts, day, visitor, path, not_found, referrer, utm_source, utm_medium, utm_campaign,
              utm_content, utm_term, country, region, city, device, browser, os, lang)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
            id, now, day, visitor, path, beacon.nf === 1 ? 1 : 0,
            referrerHost(beacon.r, new URL(request.url).hostname),
            str(beacon.us, 100), str(beacon.um, 100), str(beacon.uc, 100), str(beacon.ux, 100), str(beacon.ut, 100),
            str(cf.country, 8), str(cf.region, 100), str(cf.city, 100),
            device, browser, os, str(beacon.l, 20),
        ).run();
        return true;
    }

    if (beacon.t === "eng") {
        // Same visitor hash only, so nobody else can rewrite a page view's numbers.
        await env.DB.prepare(
            "UPDATE pageviews SET scroll = MAX(scroll, ?), engaged = MAX(engaged, ?) WHERE id = ? AND visitor = ?",
        ).bind(num(beacon.s, 100), num(beacon.e, MAX_ENGAGED), id, visitor).run();
        return true;
    }

    if (beacon.t === "ev" && EVENT_TYPES.includes(beacon.k)) {
        const name = str(beacon.n, 200);
        if (!name) return false;
        await env.DB.prepare(
            "INSERT INTO events (ts, day, visitor, pageview, path, type, name, target) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(now, day, visitor, id, path, beacon.k, name, str(beacon.g, 500)).run();
        return true;
    }

    return false;
}
