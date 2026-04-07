import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import fs from "node:fs";
import path from "node:path";

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

function readPage(relPath: string): string {
    return stripMarkdown(fs.readFileSync(path.resolve(relPath), "utf-8"));
}

export const GET: APIRoute = async () => {
    const posts = await getCollection("blog");

    const blogItems = posts.map((post) => ({
        title: post.data.title,
        description: post.data.description,
        tags: post.data.tags,
        url: `/notes/${post.id}/`,
        pubDate: post.data.pubDate.toISOString().split("T")[0],
        body: stripMarkdown(post.body ?? ""),
    }));

    const index = [...blogItems];

    return new Response(JSON.stringify(index), {
        headers: { "Content-Type": "application/json" },
    });
};
