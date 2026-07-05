import type { APIRoute } from 'astro';
import projects from '../data/projects.json';

export const GET: APIRoute = async ({ site }) => {
    const siteURL = site ?? new URL('https://beckyschmidt.me');

    // Generate projects list
    const buildingList = projects
        .map(p => `- ${p.name} (${p.href}) - ${p.description}`)
        .join('\n');

    const content = `# Becky Schmidt - Personal Website

> Senior Product Manager at Octane11 | AI & data products | Indianapolis, IN

## About This Site

This is the personal website of Becky Schmidt, a senior product manager who builds. The site tells her story (marketing degree to business analyst to senior PM of AI products), documents the production systems she has built and runs herself, and hosts her notes on product management, AI, and agency.

## Site Structure

- Homepage: ${siteURL.href}
- Notes (essays): ${siteURL.href}notes/

## Key Content

### Professional Background
Becky is a Senior Product Manager at Octane11, a B2B data and AI startup, where she was the second product hire and now owns the AI products: an AI chat built on a homegrown MCP server, and the company's first agent for campaign mapping. She got into product by teaching herself SQL and Tableau as a business analyst at a credit union.

### Things She Has Built
${buildingList}

### Notes Topics
Essays on product management, AI, agency, and building in public. Flagship essay: ${siteURL.href}notes/how-to-know-if-you-have-agency

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
