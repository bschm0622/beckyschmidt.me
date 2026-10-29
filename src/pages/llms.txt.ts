import type { APIRoute } from 'astro';
import { siteOrigin } from '@/siteConfig';
import { getLlmsContent } from '@/lib/llms';

export const GET: APIRoute = async ({ site }) => {
    const origin = siteOrigin(site);
    const c = await getLlmsContent(origin);

    const content = `${c.title}

${c.summary}

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

## More

- [Full text of every note and page](${new URL('llms-full.txt', origin).href})
- [Mini tools: custom tools built for Becky's own workflows](${new URL('mini-tools', origin).href})
- [Bookmarks: lines Becky has saved from posts and articles about building products](${new URL('bookmarks', origin).href})
- [Colophon: how this site is built](${new URL('colophon', origin).href})
`;

    return new Response(content, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
};
