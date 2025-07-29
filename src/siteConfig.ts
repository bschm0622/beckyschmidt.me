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
    description: "Built with Astro, Tailwind CSS, and Markdown.",
    href: "https://astro-boilerplate.beckyschmidt.me",
    author: "Becky Schmidt",
    locale: "en-US",

    socials: {
        github: "https://github.com/bschm0622",
        linkedin: "https://www.linkedin.com/in/becky--schmidt/",
        email: "beckyschmidt0622@gmail.com",
    },

    nav: [
        { label: "Home", href: "/" },
        { label: "About", href: "/about" },
        { label: "Blog", href: "/blog" },
        { label: "Projects", href: "/projects" },
        { label: "Resume", href: "/resume" },
        { label: "Slash Pages", href: "/slashpages" },
    ],

    copyright: `© ${new Date().getFullYear()} Becky Schmidt. All rights reserved.`,
};
