// Import the glob loader
import { glob } from "astro/loaders";
// Import utilities from `astro:content`
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// Notes collection
const notes = defineCollection({
    loader: glob({ pattern: '**/[^_]*.md', base: "./src/notes" }),
    schema: z.object({
        title: z.string(),
        slug: z.string(),
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

// Export collections
export const collections = { notes };