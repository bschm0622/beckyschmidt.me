import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
    const siteURL = site ?? new URL('https://beckyschmidt.me');

    // Fetch projects collection
    const projectEntries = await getCollection('projects');
    const sortedProjects = projectEntries.sort((a, b) => a.data.order - b.data.order);

    // Generate projects list
    const projectsList = sortedProjects
        .map(p => `- ${p.data.name} - ${p.data.tagline}`)
        .join('\n');

    const content = `# Becky Schmidt - Personal Website

> Senior Product Manager at Octane11 | B2B SaaS | Indianapolis, IN

## About This Site

This is the personal website of Becky Schmidt, a senior product manager specializing in B2B SaaS, data products, and integrations. The site showcases her professional background, side projects, and occasional blog posts about product management, AI, and technology.

## Site Structure

- Homepage: ${siteURL.href}
- Blog: ${siteURL.href}blog/
- Projects: ${siteURL.href}projects/
- Resume: ${siteURL.href}resume/
- Colophon: ${siteURL.href}colophon/

## Key Content

### Professional Background
Becky is a Senior Product Manager at Octane11, where she leads product strategy for data transformation, integrations (including LinkedIn Company Intelligence API), and AI-powered user tools. Previously worked in business analysis, martech operations, and market research.

### Side Projects
${projectsList}

### Blog Topics
Writing about product management, AI, technology, and personal reflections.

## Contact

- Email: beckyschmidt0622@gmail.com
- LinkedIn: https://www.linkedin.com/in/becky--schmidt/

## For More Details

See the full LLM guide at: ${siteURL.href}llms-full.txt
`;

    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
};
