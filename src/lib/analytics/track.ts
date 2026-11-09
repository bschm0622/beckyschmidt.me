// Client-safe: the beacon shapes the collector sends to /api/v, and a way for any script or island
// to record an interaction without importing the collector.

/** Set by signing in to /admin or by the toggle on /admin/analytics; this browser is never tracked. */
export const OPT_OUT_KEY = "analytics-off";

export type EventType = "outbound" | "search" | "copy" | "click";

export type Beacon =
    // Page view: path, full referrer (server keeps the host), UTM source/medium/campaign/content/term,
    // language, 404 flag, touchscreen.
    | {
          t: "pv"; id: string; p: string; r?: string;
          us?: string | null; um?: string | null; uc?: string | null; ux?: string | null; ut?: string | null;
          l?: string; nf?: 0 | 1; tp?: 0 | 1;
      }
    // Engagement update for a page view: max scroll percent and visible seconds so far.
    | { t: "eng"; id: string; p?: string; s: number; e: number }
    // Interaction during a page view.
    | { t: "ev"; id: string; p: string; k: EventType; n: string; g?: string | null };

export interface TrackDetail {
    type: EventType;
    name: string;
    target?: string | null;
}

/** Turns tracking off (or back on) for this browser. */
export function setTrackingOff(off: boolean): void {
    try {
        if (off) localStorage.setItem(OPT_OUT_KEY, "1");
        else localStorage.removeItem(OPT_OUT_KEY);
    } catch {}
}

export function isTrackingOff(): boolean {
    try {
        return localStorage.getItem(OPT_OUT_KEY) === "1";
    } catch {
        return false;
    }
}

export function track(type: EventType, name: string, target?: string | null): void {
    window.dispatchEvent(new CustomEvent<TrackDetail>("analytics", { detail: { type, name, target } }));
}
