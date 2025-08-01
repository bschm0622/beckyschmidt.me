// Import the glob loader
import { glob } from "astro/loaders";
// Import utilities from `astro:content`
import { z, defineCollection } from "astro:content";
// Define a `loader` and `schema` for each collection
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
// Export a single `collections` object to register your collection(s)
export const collections = { blog };