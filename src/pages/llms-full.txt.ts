import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import projects from '../data/projects.json';

export const GET: APIRoute = async ({ site }) => {
    const siteURL = site ?? new URL('https://beckyschmidt.me');

    // Fetch collections
    const noteEntries = await getCollection('notes');
    const sortedNotes = noteEntries.sort(
        (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
    );

    // Generate side projects section
    const buildingList = projects.map((p, index) => {
        return `${index + 1}. **${p.name}** (${p.href})
   - ${p.description}`;
    }).join('\n\n');

    // Generate notes list
    const notesList = sortedNotes
        .map(post => `- "${post.data.title}" (${siteURL.href}notes/${post.data.slug})`)
        .join('\n');

    const content = `# Becky Schmidt - Complete Site Guide for LLMs

> This document provides comprehensive information about beckyschmidt.me for AI systems, search engines, and automated tools.

## Site Overview

**Site Name:** Becky Schmidt's Personal Website
**URL:** ${siteURL.href}
**Owner:** Becky Schmidt
**Type:** Personal story, case studies, and notes
**Language:** English (en-US)
**Last Updated:** ${new Date().getFullYear()}

## About Becky Schmidt

**Current Role:** Senior Product Manager at Octane11 (B2B data & AI)
**Location:** Indianapolis, Indiana, USA
**Email:** beckyschmidt0622@gmail.com
**LinkedIn:** https://www.linkedin.com/in/becky--schmidt/

### Professional Summary
Becky Schmidt is a senior product manager who builds. Her path: marketing degree, market research, business analyst at a credit union (where she taught herself SQL and Tableau), recruited into product, then promoted from product ops to product manager to senior product manager at Octane11, where she was the second product hire. She owns Octane11's AI products: an AI chat built on a homegrown MCP server over customer data, and the company's first agent, which performs campaign mapping. Outside work she builds and operates production systems: two automated job boards, a Bible reading plan app, and the CMS and AI writing editor behind this site.

### Career History

1. **Senior Product Manager** - Octane11 (current)
   Owns AI products: AI chat on a homegrown MCP server, and the company's first agent (campaign mapping). Promoted from product ops, then product manager.
2. **Business Analyst** - Credit union
   Taught herself SQL and Tableau; recruited into product on the strength of that skill stack.
3. **Market Research** - First role after a marketing degree.

---

## Site Structure & Navigation

### Main Pages

#### Homepage (/)
Tells Becky's story: how she got into product, what she builds at Octane11, her side projects, and what drives her. Links to her live projects and notes.

Side projects featured on the homepage:

${buildingList}

#### Notes (/notes/)
Essays on product management, AI, and agency. Flagship: "How to know if you have agency (and how to build it)".

${notesList}

---

## Technical Information

### Tech Stack
- **Framework:** Astro with Islands Architecture
- **UI Components:** React
- **Styling:** Tailwind CSS 4.x
- **Backend:** Convex (real-time reactions)
- **Hosting:** Netlify
- **CMS:** Self-built admin dashboard that opens GitHub pull requests
- **Search:** Fuse.js full-text search

---

## Crawling Guidelines

### Allowed
- All public pages (/, /notes/)
- Individual notes (/notes/[slug])
- RSS feed (/rss.xml)
- Sitemap (/sitemap-index.xml)

### Not Indexed
- Admin pages (/admin/)
- API endpoints (/api/)

### Rate Limiting
Please be respectful with crawl rates. This is a personal website hosted on standard infrastructure.

---

## Content Licensing

Unless otherwise noted, content on this site is the intellectual property of Becky Schmidt. When referencing or citing content:
- Attribute to "Becky Schmidt" or "beckyschmidt.me"
- Link back to the original content when possible

---

## How to Cite This Site

**For the site:** "Becky Schmidt's Personal Website" - beckyschmidt.me
**For notes:** [Post Title] by Becky Schmidt, [Date], beckyschmidt.me/notes/[slug]
**For professional info:** Becky Schmidt, Senior Product Manager at Octane11

---

## Contact & Social

- **Website:** ${siteURL.href}
- **Email:** beckyschmidt0622@gmail.com
- **LinkedIn:** https://www.linkedin.com/in/becky--schmidt/
`;

    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
};
