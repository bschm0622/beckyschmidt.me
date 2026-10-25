import { glob, file } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

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

const projects = defineCollection({
    loader: file("src/data/projects.json", {
        // getCollection() doesn't preserve file order; consumers must sort by `order`.
        parser: (text) =>
            JSON.parse(text).map((p: { name: string }, i: number) => ({ id: p.name, order: i, ...p })),
    }),
    schema: z.object({
        name: z.string(),
        href: z.string().url(),
        description: z.string(),
        icon: z.string().optional(),
        order: z.number(),
    })
});

const miniTools = defineCollection({
    loader: file("src/data/mini-tools.json", {
        parser: (text) =>
            JSON.parse(text).map((t: { name: string }, i: number) => ({ id: t.name, order: i, ...t })),
    }),
    schema: z.object({
        name: z.string(),
        href: z.string().startsWith("/mini-tools/"),
        description: z.string(),
        icon: z.string().optional(),
        order: z.number(),
    })
});

export const collections = { notes, projects, miniTools };
