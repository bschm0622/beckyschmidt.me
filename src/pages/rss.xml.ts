import rss from '@astrojs/rss';
import { SITE } from '@/siteConfig';
import { getSortedNotes, noteUrl } from '@/lib/notes';

export async function GET(context: any) {
    const posts = await getSortedNotes();

    return rss({
        title: SITE.rss.title,
        description: SITE.rss.description,
        site: context.site,
        items: posts.map(post => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.pubDate,
            link: noteUrl(post),
            // optional: you can add author, content, etc here too
        })),
        customData: `<language>${SITE.rss.language}</language>`,
    });
}
