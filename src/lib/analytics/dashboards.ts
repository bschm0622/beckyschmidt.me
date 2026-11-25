// Server-only: the sites whose full dashboard lives at /admin/analytics. This site and the two that run
// the same tracker on the same D1 schema (welldesignedsites, CEO Paycheck); each keeps recording its own
// visits, and this only ever reads (SELECTs) their databases. BiblePlan and Remote PM Jobs are built
// differently and keep their own dashboards.
import { env } from "cloudflare:workers";

/** A family of click events named `${prefix}<detail>`, shown as its own list and as a step in a visit. */
export interface ClickKind {
    prefix: string;
    title: string;
    step: (detail: string, target: string | null) => { text: string; meta?: string };
}

export interface Dashboard {
    id: string;
    name: string;
    icon: string;
    host: string;
    /** The site's brand color, for the dashboard's bars; none keeps this site's neutral gray. */
    accent?: string;
    db: () => D1Database;
    /**
     * What counts as a person. This site drops bots before they're stored, so it reads `pageviews`;
     * the others keep bots and filter them through their `people` view.
     */
    table: "pageviews" | "people";
    clicks: ClickKind[];
    /** Plain words for other click events, by name. */
    clickNames: Record<string, string>;
    /** Whether the site records searches in its own search box as "search" events. */
    searches: boolean;
}

export const DASHBOARDS: Dashboard[] = [
    {
        id: "beckyschmidt",
        name: "Personal site",
        icon: "/favicon.svg",
        host: "beckyschmidt.me",
        db: () => env.DB,
        table: "pageviews",
        clicks: [],
        clickNames: { "theme-toggle": "Toggled the theme", "search-open": "Opened search" },
        searches: true,
    },
    {
        id: "welldesignedsites",
        name: "Well Designed Sites",
        icon: "/project-icons/welldesignedsites.svg",
        host: "welldesignedsites.com",
        accent: "#0b7a6a",
        db: () => env.WDS_DB,
        table: "people",
        clicks: [
            { prefix: "open:", title: "Sites opened", step: (d) => ({ text: `Opened ${d}` }) },
            { prefix: "visit:", title: "Visit site clicks", step: (d) => ({ text: `Visited ${d}` }) },
            { prefix: "download:", title: "Screenshot downloads", step: (d) => ({ text: `Downloaded the ${d} screenshot` }) },
            { prefix: "check:", title: "Tool checks", step: (d, target) => ({ text: `Checked ${target ?? "a site"}`, meta: d }) },
        ],
        clickNames: { "badge-copy": "Copied the badge code" },
        searches: false,
    },
    {
        id: "ceopaycheck",
        name: "CEO Paycheck",
        icon: "/project-icons/ceopaycheck.svg",
        host: "ceopaycheck.com",
        accent: "#3f8f5a",
        db: () => env.CP_DB,
        table: "people",
        clicks: [
            {
                prefix: "search:",
                title: "Lookups",
                step: (d, target) => ({ text: `Looked up ${d}`, meta: target ? `typed "${target}"` : undefined }),
            },
            { prefix: "search-miss:", title: "Searches with no match", step: (d) => ({ text: `Searched "${d}", no match` }) },
        ],
        clickNames: {},
        searches: false,
    },
];

export const dashboardFor = (id: string | null) => DASHBOARDS.find((d) => d.id === id) ?? DASHBOARDS[0];
