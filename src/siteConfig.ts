export interface NavLink {
    label: string;
    href: string;
    external?: boolean;
}

export interface SiteConfiguration {
    title: string;
    name: string;
    description: string;
    href: string;
    author: string;
    locale: string;

    keywords?: string[];
    ogImage?: string;
    twitterHandle?: string;

    email?: string;
    phone?: string;
    address?: string;

    socials?: {
        twitter?: string;
        github?: string;
        linkedin?: string;
        youtube?: string;
        [key: string]: string | undefined;
    };

    nav: NavLink[];
    footerNav?: NavLink[];

    copyright?: string;
}

export const SITE: SiteConfiguration = {
    title: "",
    name: "Becky Schmidt",
    description: "Becky Schmidt's personal website.",
    href: "https://beckyschmidt.me",
    author: "Becky Schmidt",
    locale: "en-US",

    socials: {
        linkedin: "https://www.linkedin.com/in/becky--schmidt/",
        email: "beckyschmidt0622@gmail.com",
    },

    nav: [
        { label: "Home", href: "/" },
        { label: "Blog", href: "/blog" },
        { label: "Projects", href: "/projects" },
        { label: "Resume", href: "/resume" },
        { label: "Colophon", href: "/colophon" },
    ],

    copyright: `© ${new Date().getFullYear()} Becky Schmidt - all rights reserved`,
};
