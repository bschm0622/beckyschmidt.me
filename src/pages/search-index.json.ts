import type { APIRoute } from "astro";
import { getSortedNotes, noteUrl } from "@/lib/notes";
import { parseFrontmatter } from "@/lib/frontmatter";
import colophonSource from "@/story/colophon.md?raw";
import miniTools from "@/data/mini-tools.json";

export const prerender = true;

function stripMarkdown(content: string): string {
    return parseFrontmatter(content).body
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/`[^`]+`/g, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/^[-*]\s+/gm, "")
        .replace(/\s+/g, " ")
        .trim();
}

export const GET: APIRoute = async () => {
    const posts = await getSortedNotes();

    const noteItems = posts.map((post) => ({
        kind: "note",
        title: post.data.title,
        description: post.data.description,
        tags: post.data.tags,
        url: noteUrl(post),
        pubDate: post.data.pubDate.toISOString().split("T")[0],
        body: stripMarkdown(post.body ?? ""),
    }));

    const colophon = parseFrontmatter(colophonSource).data;
    const pageItems = [
        {
            kind: "page",
            title: String(colophon.title),
            description: String(colophon.description),
            tags: [],
            url: "/colophon/",
            pubDate: "",
            body: stripMarkdown(colophonSource),
        },
        {
            kind: "page",
            title: "Mini tools",
            description: "Custom tools built for my own workflows, hosted here.",
            tags: [],
            url: "/mini-tools/",
            pubDate: "",
            body: miniTools.map((t) => `${t.name}. ${t.description}`).join(" "),
        },
    ];

    const index = [...noteItems, ...pageItems];

    return new Response(JSON.stringify(index), {
        headers: { "Content-Type": "application/json" },
    });
};
