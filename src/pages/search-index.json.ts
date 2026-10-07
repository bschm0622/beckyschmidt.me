import type { APIRoute } from "astro";
import { getSortedNotes, noteUrl } from "@/lib/notes";
import { parseFrontmatter } from "@/lib/frontmatter";
import colophonSource from "@/story/colophon.md?raw";

export const prerender = true;

function stripMarkdown(content: string): string {
    return parseFrontmatter(content).body
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")  // images (incl. icons inside links)
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

    // Standalone pages, searchable by their copy (the palette lists them under
    // "Go to", never as notes). pubDate is empty: pages aren't dated.
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
    ];

    const index = [...noteItems, ...pageItems];

    return new Response(JSON.stringify(index), {
        headers: { "Content-Type": "application/json" },
    });
};
