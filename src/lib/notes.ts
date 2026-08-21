/**
 * Server-side helpers for the notes collection.
 *
 * This module imports `astro:content`, which is server-only — do not import
 * it from client components. The client-safe pieces (`formatDate`, slugify)
 * live in `@/lib/slugify` and are re-exported here for server-side callers.
 */
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

export { formatDate, slugifyStr, slugifyAll } from "@/lib/slugify";

export type Note = CollectionEntry<"notes">;

/** All notes, sorted by pubDate descending (newest first). */
export async function getSortedNotes(): Promise<Note[]> {
    const notes = await getCollection("notes");
    return notes.sort(
        (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
    );
}

/** Canonical URL path for a note (trailing slash, matching site links). */
export function noteUrl(post: Pick<Note, "id">): string {
    return `/notes/${post.id}/`;
}
