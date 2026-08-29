// Import the glob and file loaders
import { glob, file } from "astro/loaders";
// Import utilities from `astro:content`
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// Notes collection — a note's URL slug is its `id` (the filename).
const notes = defineCollection({
    loader: glob({ pattern: '**/[^_]*.md', base: "./src/notes" }),
    schema: z.object({
        title: z.string(),
        pubDate: z.union([z.date(), z.string()]).transform(val =>
            typeof val === 'string' ? new Date(val) : val
        ),
        description: z.string(),
        author: z.string(),
        tags: z
            .union([z.string(), z.array(z.string())])
            .transform((val) =>
                typeof val === "string"
                    ? val.split(",").map((t) => t.trim())
                    : val
            ),
    })
});

// Projects collection — edit the list in src/data/projects.json.
const projects = defineCollection({
    loader: file("src/data/projects.json", {
        // Entries in the JSON have no `id` field; derive one from the name.
        // `order` records array position — getCollection() does not guarantee
        // file order, so consumers must sort by it.
        parser: (text) =>
            JSON.parse(text).map((p: { name: string }, i: number) => ({ id: p.name, order: i, ...p })),
    }),
    schema: z.object({
        name: z.string(),
        href: z.string().url(),
        description: z.string(),
        order: z.number(),
    })
});

// Export collections
export const collections = { notes, projects };
