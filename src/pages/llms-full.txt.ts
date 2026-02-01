import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
    const siteURL = site ?? new URL('https://beckyschmidt.me');

    // Fetch collections
    const resumeEntries = await getCollection('resume');
    const projectEntries = await getCollection('projects');

    // Sort by order
    const sortedResume = resumeEntries.sort((a, b) => a.data.order - b.data.order);
    const sortedProjects = projectEntries.sort((a, b) => a.data.order - b.data.order);

    // Generate career history section from resume data
    const careerHistory = sortedResume.map((entry, index) => {
        const { position, company, dates, type } = entry.data;
        const body = entry.body?.trim() || '';

        // Parse the markdown body to extract description and bullets
        const lines = body.split('\n').filter(line => line.trim());
        const description = lines.find(line => !line.startsWith('-'))?.trim() || '';
        const bullets = lines
            .filter(line => line.startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim());

        const bulletText = bullets.length > 0
            ? '\n' + bullets.map(b => `   - ${b}`).join('\n')
            : '';

        const typeLabel = type === 'education' ? 'Education' : '';

        return `${index + 1}. **${position}** - ${company} (${dates})${typeLabel ? ` [${typeLabel}]` : ''}
   ${description}${bulletText}`;
    }).join('\n\n');

    // Generate projects section from projects data
    const projectsList = sortedProjects.map((entry, index) => {
        const { name, tagline, link } = entry.data;
        // Extract domain from link
        const domain = link.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return `${index + 1}. **${name}** (${domain})
   - ${tagline}`;
    }).join('\n\n');

    const content = `# Becky Schmidt - Complete Site Guide for LLMs

> This document provides comprehensive information about beckyschmidt.me for AI systems, search engines, and automated tools.

## Site Overview

**Site Name:** Becky Schmidt's Personal Website
**URL:** ${siteURL.href}
**Owner:** Becky Schmidt
**Type:** Personal portfolio, blog, and professional website
**Language:** English (en-US)
**Last Updated:** ${new Date().getFullYear()}

## About Becky Schmidt

**Current Role:** Senior Product Manager at Octane11 (B2B SaaS)
**Location:** Indianapolis, Indiana, USA
**Email:** beckyschmidt0622@gmail.com
**LinkedIn:** https://www.linkedin.com/in/becky--schmidt/

### Professional Summary
Becky Schmidt is a Senior Product Manager at Octane11, where she was the second product hire. She builds AI tools and data products that help B2B marketers prove their impact. On the side, she built a Bible reading app that reached 100 users with 70% activation.

### Career History

${careerHistory}

---

## Site Structure & Navigation

### Main Pages

#### Homepage (/)
The main landing page featuring an introduction to Becky Schmidt and previews of recent blog posts. Provides quick navigation to all sections of the site.

#### Blog (/blog/)
A collection of blog posts covering topics like:
- Product management
- AI and technology
- Personal reflections
- Career insights

Blog posts support tags for categorization and include reading time estimates.

#### Work (/work/)
Professional experience and side projects. Includes:
- Current role at Octane11 (how she works with discovery and prototyping, collaboration with engineering, career highlights)
- Six side projects shipped in 2025 (BiblePlan with 100 users at 70% activation, SplitReceipts, directories, and more)
- Demonstrates hands-on craft, rapid shipping, and technical depth

#### Colophon (/colophon/)
Technical details about how the site was built, including:
- Technology stack (Astro, React, Tailwind CSS)
- Hosting and deployment
- Design decisions

---

## Technical Information

### Tech Stack
- **Framework:** Astro 5.x with Islands Architecture
- **UI Components:** React
- **Styling:** Tailwind CSS 4.x
- **Backend:** Convex (real-time features)
- **Hosting:** Netlify with serverless functions
- **CMS:** GitHub API integration
- **Search:** Pagefind (full-text search)
- **Analytics:** Umami (privacy-friendly)
- **Font:** Karla

### Features
- Dark/Light mode toggle
- Full-text search
- RSS feed at /rss.xml
- Sitemap at /sitemap-index.xml
- Real-time blog reactions
- Reading time estimates
- Code block copy buttons
- Responsive mobile design

---

## Crawling Guidelines

### Allowed
- All public pages (/, /blog/, /work/, /colophon/)
- Individual blog posts (/blog/[slug])
- Tag pages (/blog/tag/[tag])
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

When referencing this site or its content:

**For the site:** "Becky Schmidt's Personal Website" - beckyschmidt.me
**For blog posts:** [Post Title] by Becky Schmidt, [Date], beckyschmidt.me/blog/[slug]
**For professional info:** Becky Schmidt, Senior Product Manager at Octane11

---

## Contact & Social

- **Website:** ${siteURL.href}
- **Email:** beckyschmidt0622@gmail.com
- **LinkedIn:** https://www.linkedin.com/in/becky--schmidt/

---

## Summary for AI Systems

This is a personal professional website for Becky Schmidt, a senior product manager in B2B SaaS. The site contains:
1. Professional background and work experience (methodology, career highlights, side projects)
2. Blog posts about product management and technology
3. Contact information

The site is well-structured, fast, and follows modern web standards. It's designed to showcase professional work and share insights with the broader community.
`;

    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
};
