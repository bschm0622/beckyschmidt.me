/**
 * Shared content for /llms.txt and /llms-full.txt (server-only).
 *
 * Nothing here is hand-written: every fact comes from the same sources the
 * pages render (siteConfig, src/data/career.ts, src/story/*.md, the projects
 * and notes collections), so the llms files change whenever the site does.
 */
import { getCollection } from "astro:content";
import { SITE } from "@/siteConfig";
import { getSortedNotes, noteUrl, formatDate, type Note } from "@/lib/notes";
import * as hero from "@/story/hero.md";
import * as colophon from "@/story/colophon.md";
import { ROLES, SKILLS, EDUCATION } from "@/data/career";

/**
 * Turn site markdown into llms-friendly markdown: drop inline icon images
 * (`[![](/tool-icons/x.png)Name](url)` → `[Name](url)`), make root-relative
 * links absolute, optionally remove the leading H1, and push headings down
 * `demote` levels so they nest under the file's own sections.
 */
export function toLlmsMarkdown(md: string, origin: URL, { stripH1 = false, demote = 0 } = {}): string {
    let out = md
        .replace(/!\[\]\([^)]*\)/g, "")
        .replace(/\]\((\/[^)\s]*)\)/g, (_, path) => `](${new URL(path, origin).href})`);
    if (stripH1) out = out.replace(/^\s*#\s+.*\n/, "");
    if (demote) out = out.replace(/^(#{1,6}) /gm, (_, h) => `${"#".repeat(Math.min(6, h.length + demote))} `);
    return out.trim();
}

/** "2025-09" → "Sep 2025" */
const monthYear = (ym: string) =>
    new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export async function getLlmsContent(origin: URL) {
    const projects = (await getCollection("projects")).sort((a, b) => a.data.order - b.data.order);
    const notes = await getSortedNotes();

    const noteLine = (post: Note) => {
        const url = new URL(noteUrl(post), origin).href;
        const desc = post.data.description ? `: ${post.data.description}` : "";
        return `- [${post.data.title}](${url}) (${formatDate(post.data.pubDate, "month-year")})${desc}`;
    };

    return {
        title: `# ${SITE.name}`,
        summary: `> ${SITE.description}`,
        intro: toLlmsMarkdown(hero.rawContent(), origin, { stripH1: true }),
        colophon: toLlmsMarkdown(colophon.rawContent(), origin),
        projects: projects.map(({ data: p }) => `- [${p.name}](${p.href}): ${p.description}`).join("\n"),
        experience: ROLES.map((r) =>
            `- ${r.title}, ${r.org} (${monthYear(r.start)} to ${r.end ? monthYear(r.end) : "present"})`).join("\n"),
        skills: SKILLS.join(", "),
        education: `- ${EDUCATION.degree}, ${EDUCATION.school} (${EDUCATION.college})`,
        notesList: notes.map(noteLine).join("\n"),
        notes,
        links: [
            `- Email: ${SITE.email}`,
            `- LinkedIn: ${SITE.socials.linkedin}`,
            `- X: ${SITE.socials.x}`,
            `- Website: ${origin.href}`,
        ].join("\n"),
    };
}
