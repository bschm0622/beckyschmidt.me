import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

export { formatDate, slugifyStr, slugifyAll } from "@/lib/slugify";

export type Note = CollectionEntry<"notes">;

export async function getSortedNotes(): Promise<Note[]> {
    const notes = await getCollection("notes");
    return notes.sort(
        (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
    );
}

export function noteUrl(post: Pick<Note, "id">): string {
    return `/notes/${post.id}/`;
}
