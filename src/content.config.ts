// Import the glob loader
import { glob } from "astro/loaders";
// Import utilities from `astro:content`
import { z, defineCollection } from "astro:content";

// Blog posts collection
const blog = defineCollection({
    loader: glob({ pattern: '**/[^_]*.md', base: "./src/blog" }),
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

// Case studies for things I've built (rendered at /building)
const building = defineCollection({
    loader: glob({ pattern: '**/[^_]*.md', base: "./src/building" }),
    schema: z.object({
        title: z.string(),
        tagline: z.string(),
        order: z.number(),
        links: z
            .array(
                z.object({
                    label: z.string(),
                    href: z.string(),
                })
            )
            .default([]),
    })
});

// Export collections
export const collections = { blog, building };