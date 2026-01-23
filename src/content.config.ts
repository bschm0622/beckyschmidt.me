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

// Resume/work history collection
// Body content contains: first paragraph = description, bullet list = accomplishments
const resume = defineCollection({
    loader: glob({ pattern: '**/[^_]*.md', base: "./src/content/resume" }),
    schema: z.object({
        position: z.string(),
        company: z.string(),
        companyUrl: z.string().url(),
        location: z.string(),
        dates: z.string(),
        order: z.number(),
        type: z.enum(['job', 'education']).default('job'),
    })
});

// Projects/portfolio collection
const projects = defineCollection({
    loader: glob({ pattern: '**/[^_]*.md', base: "./src/content/projects" }),
    schema: z.object({
        name: z.string(),
        tagline: z.string(),
        link: z.string().url(),
        order: z.number(),
    })
});

// Export collections
export const collections = { blog, resume, projects };