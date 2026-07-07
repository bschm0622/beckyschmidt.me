import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

function stripMarkdown(content: string): string {
    return content
        .replace(/^---[\s\S]*?---\n/, "")   // frontmatter
        .replace(/^#{1,6}\s+/gm, "")         // headings
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1") // bold/italic
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // links → label only
        .replace(/`[^`]+`/g, "")             // inline code
        .replace(/```[\s\S]*?```/g, "")      // code blocks
        .replace(/^[-*]\s+/gm, "")           // list markers
        .replace(/\s+/g, " ")
        .trim();
}

export const GET: APIRoute = async () => {
    const posts = await getCollection("notes");

    const noteItems = posts.map((post) => ({
        title: post.data.title,
        description: post.data.description,
        tags: post.data.tags,
        url: `/notes/${post.id}/`,
        pubDate: post.data.pubDate.toISOString().split("T")[0],
        body: stripMarkdown(post.body ?? ""),
    }));

    const index = [...noteItems];

    return new Response(JSON.stringify(index), {
        headers: { "Content-Type": "application/json" },
    });
};
