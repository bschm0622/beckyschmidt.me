// Browser side of the self-hosted analytics: one page view per navigation (the ClientRouter swaps
// pages without reloading, so it hooks astro:page-load), updated with scroll depth and visible time,
// plus outbound clicks, copies, [data-track] clicks and anything sent through track().
import { isTrackingOff as optedOut, type Beacon, type TrackDetail } from "@/lib/analytics/track";
import { SITE } from "@/siteConfig";

const ENDPOINT = "/api/v";
/** Only the live site is tracked: never localhost, the dev server or preview URLs. */
const LIVE = location.hostname.replace(/^www\./, "") === new URL(SITE.href).hostname;

interface PageView {
    id: string;
    path: string;
    scroll: number;
    engagedMs: number;
    visibleSince: number | null;
    sent: string;
}

let current: PageView | null = null;
let firstLoad = true;

function send(beacon: Beacon): void {
    if (!LIVE || optedOut()) return;
    const body = JSON.stringify(beacon);
    if (!navigator.sendBeacon?.(ENDPOINT, body)) {
        fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(() => {});
    }
}

function newId(): string {
    return crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function scrollPercent(): number {
    const doc = document.documentElement;
    const seen = window.scrollY + window.innerHeight;
    return Math.min(100, Math.round((seen / Math.max(doc.scrollHeight, 1)) * 100));
}

function engagedSeconds(pv: PageView): number {
    const running = pv.visibleSince === null ? 0 : performance.now() - pv.visibleSince;
    return Math.round((pv.engagedMs + running) / 1000);
}

function flush(): void {
    if (!current) return;
    const s = current.scroll;
    const e = engagedSeconds(current);
    const key = `${s}:${e}`;
    if (key === current.sent) return;
    current.sent = key;
    send({ t: "eng", id: current.id, s, e });
}

function startPageView(): void {
    flush();
    current = null;
    if (!LIVE || optedOut() || navigator.webdriver || location.pathname.startsWith("/admin")) return;

    current = {
        id: newId(),
        path: location.pathname,
        scroll: scrollPercent(),
        engagedMs: 0,
        visibleSince: document.visibilityState === "visible" ? performance.now() : null,
        sent: "",
    };
    const query = new URLSearchParams(location.search);
    send({
        t: "pv",
        id: current.id,
        p: current.path,
        // After the first page, document.referrer is stale; in-site moves aren't referrals.
        r: firstLoad ? document.referrer : "",
        us: query.get("utm_source"),
        um: query.get("utm_medium"),
        uc: query.get("utm_campaign"),
        ux: query.get("utm_content"),
        ut: query.get("utm_term"),
        l: navigator.language,
        nf: document.querySelector("[data-not-found]") ? 1 : 0,
        tp: navigator.maxTouchPoints > 1 ? 1 : 0,
    });
    firstLoad = false;
}

function record({ type, name, target }: TrackDetail): void {
    if (!current) return;
    send({ t: "ev", id: current.id, p: current.path, k: type, n: name, g: target ?? null });
}

function onLinkClick(e: MouseEvent): void {
    const el = (e.target as Element | null)?.closest?.("a[href], [data-track]");
    if (!el) return;
    const tracked = el.getAttribute("data-track");
    if (tracked) record({ type: "click", name: tracked });

    if (!(el instanceof HTMLAnchorElement)) return;
    if (el.protocol === "mailto:") {
        record({ type: "outbound", name: "email" });
    } else if (/^https?:$/.test(el.protocol) && el.host !== location.host) {
        record({ type: "outbound", name: el.hostname.replace(/^www\./, ""), target: el.origin + el.pathname });
    }
}

let scrollQueued = false;
function onScroll(): void {
    if (scrollQueued || !current) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
        scrollQueued = false;
        if (current) current.scroll = Math.max(current.scroll, scrollPercent());
    });
}

function onVisibility(): void {
    if (!current) return;
    if (document.visibilityState === "hidden") {
        if (current.visibleSince !== null) current.engagedMs += performance.now() - current.visibleSince;
        current.visibleSince = null;
        flush();
    } else {
        current.visibleSince = performance.now();
    }
}

document.addEventListener("astro:page-load", startPageView);
document.addEventListener("click", onLinkClick, { capture: true });
// Middle-click opens outbound links in a new tab without a click event.
document.addEventListener("auxclick", (e) => e.button === 1 && onLinkClick(e), { capture: true });
document.addEventListener("copy", () => {
    const text = window.getSelection()?.toString().trim().replace(/\s+/g, " ");
    if (text) record({ type: "copy", name: text.slice(0, 200) });
});
window.addEventListener("scroll", onScroll, { passive: true });
document.addEventListener("visibilitychange", onVisibility);
window.addEventListener("pagehide", flush);
window.addEventListener("analytics", (e) => record((e as CustomEvent<TrackDetail>).detail));
