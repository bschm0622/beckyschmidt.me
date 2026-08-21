export interface NavLink {
    label: string;
    href: string;
    external?: boolean;
}

export interface SiteConfiguration {
    /** Site + person name, used in titles, meta author, and schema.org. */
    name: string;
    description: string;
    /** Canonical origin, used as fallback when Astro.site is unset. */
    href: string;
    author: string;
    locale: string;

    email: string;
    jobTitle: string;
    employer: { name: string; url: string };
    location: { locality: string; region: string; country: string };

    socials: {
        linkedin: string;
    };

    /** Default Open Graph image path. */
    ogImage: string;
    analytics: { umamiWebsiteId: string };
    rss: { title: string; description: string; language: string };
    /** theme-color meta values; keep in sync with src/styles/global.css. */
    themeColors: { light: string; dark: string };

    nav: NavLink[];
}

export const SITE: SiteConfiguration = {
    name: "Becky Schmidt",
    description: "Becky Schmidt's personal website.",
    href: "https://beckyschmidt.me",
    author: "Becky Schmidt",
    locale: "en-US",

    email: "beckyschmidt0622@gmail.com",
    jobTitle: "Senior Product Manager",
    employer: { name: "Octane11", url: "https://octane11.com" },
    location: { locality: "Indianapolis", region: "IN", country: "US" },

    socials: {
        linkedin: "https://www.linkedin.com/in/becky--schmidt/",
    },

    ogImage: "/og.png",
    analytics: { umamiWebsiteId: "2d238baf-947c-468a-aac9-1ac81b265110" },
    rss: {
        title: "Becky's notes",
        description: "Becky's notes and writing",
        language: "en-us",
    },
    themeColors: { light: "#faf9f6", dark: "#18181b" },

    nav: [
        { label: "Home", href: "/" },
        { label: "Notes", href: "/notes" },
    ],
};

/** The site origin as a URL, falling back to SITE.href when Astro.site is unset. */
export function siteOrigin(site?: URL): URL {
    return site ?? new URL(SITE.href);
}
