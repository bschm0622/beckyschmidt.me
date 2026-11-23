// Server-only: Google Search Console numbers for /admin, read with a service account that Becky added
// as a Restricted user on each property. The key is the account's JSON file, in GSC_SERVICE_ACCOUNT.
import { getSecret } from "astro:env/server";
import type { Row } from "@/lib/analytics/stats";

export interface SearchSummary {
    clicks: number;
    impressions: number;
    /** Average position in results, weighted by impressions; null with no impressions. */
    position: number | null;
    /** Top searches by impressions; `detail` holds clicks, only when there were some. */
    queries: Row[];
    /** Latest day with data, YYYY-MM-DD in Pacific time (Google's day); null when there's none. */
    through: string | null;
    error?: string;
}

const API = "https://www.googleapis.com/webmasters/v3";
const CACHE_MS = 30 * 60_000;

let token: { value: string; expires: number } | null = null;
let properties: string[] | null = null;
const cache = new Map<string, { at: number; data: SearchSummary }>();

const base64url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encode = (text: string) => new TextEncoder().encode(text);

/** An OAuth token for the service account, from a self-signed JWT (Google's server-to-server flow). */
async function accessToken(): Promise<string> {
    if (token && token.expires > Date.now() + 60_000) return token.value;
    const key = JSON.parse(getSecret("GSC_SERVICE_ACCOUNT")!) as { client_email: string; private_key: string };
    const now = Math.floor(Date.now() / 1000);
    const unsigned = [
        { alg: "RS256", typ: "JWT" },
        {
            iss: key.client_email,
            scope: "https://www.googleapis.com/auth/webmasters.readonly",
            aud: "https://oauth2.googleapis.com/token",
            iat: now,
            exp: now + 3600,
        },
    ].map((part) => base64url(encode(JSON.stringify(part)))).join(".");
    const der = Uint8Array.from(atob(key.private_key.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
    const signingKey = await crypto.subtle.importKey(
        "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
    );
    const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signingKey, encode(unsigned)));

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: `${unsigned}.${base64url(signature)}`,
        }),
    });
    if (!response.ok) throw new Error(`Google sign-in failed (${response.status})`);
    const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
    token = { value: access_token, expires: Date.now() + expires_in * 1000 };
    return token.value;
}

async function google<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API}${path}`, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`Search Console ${response.status}`);
    return response.json() as Promise<T>;
}

/**
 * The property the service account can see for `host`: a domain property, or a URL-prefix one.
 * A miss re-reads the list, so a property shared with the account later shows up without a restart.
 */
async function propertyFor(host: string, fresh = false): Promise<string | undefined> {
    if (fresh || !properties) {
        properties = ((await google<{ siteEntry?: { siteUrl: string }[] }>("/sites")).siteEntry ?? []).map((s) => s.siteUrl);
    }
    const bare = host.replace(/^www\./, "");
    const match =
        properties.find((p) => p === `sc-domain:${bare}`) ??
        properties.find((p) => p.startsWith("http") && new URL(p).hostname.replace(/^www\./, "") === bare);
    return match ?? (fresh ? undefined : propertyFor(host, true));
}

const pacificDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });

/**
 * Clicks, impressions, position and top searches for the last `days` of Google's (Pacific) days,
 * including the fresh, not-yet-final data. Null when no key is configured; failures come back as
 * `error` so one site can't break the page.
 */
export async function searchSummary(host: string, days: number): Promise<SearchSummary | null> {
    if (!getSecret("GSC_SERVICE_ACCOUNT")) return null;
    const cached = cache.get(`${host}|${days}`);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;

    const empty: SearchSummary = { clicks: 0, impressions: 0, position: null, queries: [], through: null };
    try {
        const property = await propertyFor(host);
        if (!property) return { ...empty, error: "The service account hasn't been added to this property." };

        const endDate = pacificDay.format(new Date());
        const startDate = pacificDay.format(new Date(Date.parse(`${endDate}T12:00:00Z`) - (days - 1) * 86_400_000));
        type Rows = { rows?: { keys: string[]; clicks: number; impressions: number; position: number }[] };
        const query = (dimension: "date" | "query", rowLimit: number) =>
            google<Rows>(`/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
                startDate, endDate, dimensions: [dimension], rowLimit, dataState: "all",
            });
        // Google orders by clicks, but most searches here have none, so rank by impressions instead.
        const [byDay, byQuery] = await Promise.all([query("date", days), query("query", 50)]);

        const dayRows = byDay.rows ?? [];
        const impressions = dayRows.reduce((sum, r) => sum + r.impressions, 0);
        const data: SearchSummary = {
            clicks: dayRows.reduce((sum, r) => sum + r.clicks, 0),
            impressions,
            position: impressions ? dayRows.reduce((sum, r) => sum + r.position * r.impressions, 0) / impressions : null,
            queries: (byQuery.rows ?? [])
                .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
                .slice(0, 5)
                .map((r) => ({
                    label: r.keys[0],
                    count: r.impressions,
                    detail: r.clicks ? `${r.clicks.toLocaleString("en-US")} ${r.clicks === 1 ? "click" : "clicks"}` : undefined,
                })),
            through: dayRows.map((r) => r.keys[0]).sort().at(-1) ?? null,
        };
        cache.set(`${host}|${days}`, { at: Date.now(), data });
        return data;
    } catch (err) {
        return { ...empty, error: err instanceof Error ? err.message : "Search Console failed" };
    }
}
