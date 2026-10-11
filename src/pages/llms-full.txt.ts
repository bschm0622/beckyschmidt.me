import type { APIRoute } from 'astro';
import { siteOrigin } from '@/siteConfig';
import { noteUrl, formatDate } from '@/lib/notes';
import { getLlmsContent, toLlmsMarkdown } from '@/lib/llms';

// Built entirely from live site content; see src/lib/llms.ts.
export const GET: APIRoute = async ({ site }) => {
    const origin = siteOrigin(site);
    const c = await getLlmsContent(origin);

    const fullNotes = c.notes.map((post) => `### ${post.data.title}

URL: ${new URL(noteUrl(post), origin).href}
Published: ${formatDate(post.data.pubDate, "month-year")}

${toLlmsMarkdown(post.body ?? '', origin, { demote: 2 })}`).join('\n\n---\n\n');

    const content = `${c.title}

${c.summary}

## About

${c.intro}

## Experience

${c.experience}

## Education

${c.education}

## Skills

${c.skills}

## Projects

${c.projects}

## Notes

${c.notesList}

## Contact

${c.links}

## Colophon

${c.colophon}

## Full notes

${fullNotes}
`;

    return new Response(content, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
};
