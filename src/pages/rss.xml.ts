import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context : any) {
    const posts = await getCollection('blog');

    return rss({
        title: "Becky's blog",
        description: "Becky's personal blog",
        site: context.site,
        items: posts.map(post => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.pubDate,
            link: `/blog/${post.data.slug}/`,
            // optional: you can add author, content, etc here too
        })),
        customData: `<language>en-us</language>`,
    });
}
