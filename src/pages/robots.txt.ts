import type { APIRoute } from 'astro';

const getRobotsTxt = (siteURL: URL) => `\
User-agent: *
Allow: /

Sitemap: ${new URL('sitemap-index.xml', siteURL).href}

# LLM-specific files
# See https://llmstxt.org for more information
LLMs-Txt: ${new URL('llms.txt', siteURL).href}
LLMs-Full-Txt: ${new URL('llms-full.txt', siteURL).href}
`;

export const GET: APIRoute = ({ site }) => {
    const siteURL = site ?? new URL('https://beckyschmidt.me');
    return new Response(getRobotsTxt(siteURL));
};