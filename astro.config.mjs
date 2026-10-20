// @ts-check
import { defineConfig, fontProviders, envField } from 'astro/config';
import sitemap from "@astrojs/sitemap";
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import rehypeExternalLinks from 'rehype-external-links';
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';
import { rehypeImageSize } from './src/lib/rehype-image-size.mjs';


import tailwindcss from '@tailwindcss/vite';

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://beckyschmidt.me",

  // Astro 7 changed the default to 'jsx' (React-style whitespace stripping).
  // Pinned to `true` to keep v6's HTML output byte-for-byte.
  compressHTML: true,

  integrations: [
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/admin') }),
    react()
  ],
    

  env: {
    schema: {
      CONVEX_URL: envField.string({
        access: "public",
        context: "client",
      }),
      ADMIN_PASSWORD: envField.string({
        access: "secret",
        context: "server",
        optional: true,
      }),
      GITHUB_TOKEN: envField.string({
        access: "secret",
        context: "server",
        optional: true,
      }),
      GITHUB_OWNER: envField.string({
        access: "public",
        context: "server",
      }),
      GITHUB_REPO: envField.string({
        access: "public",
        context: "server",
      }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle every package the server-rendered pages import. Without this,
    // Vite discovers some of them only when a page that uses them is first
    // visited (e.g. the Starwind components on CleanShot), re-bundles, and the
    // already-loaded worker keeps pointing at the old bundle hashes, failing
    // with "The file does not exist at node_modules/.vite/deps_ssr/...".
    // When a page starts importing a new package, add it here.
    // Same for the browser bundle: a late re-bundle there reloads the page
    // mid-session and can load two copies of React ("Invalid hook call").
    optimizeDeps: {
      include: [
        "@starwind-ui/runtime/button",
        "astro/virtual-modules/transitions-events.js",
        "astro/virtual-modules/transitions-router.js",
        "astro/virtual-modules/transitions-swap-functions.js",
        "astro/virtual-modules/transitions-types.js",
      ],
    },
    environments: {
      ssr: {
        optimizeDeps: {
          include: [
            "@starwind-ui/astro/button",
            "@starwind-ui/astro/collapsible",
            "@starwind-ui/astro/dropzone",
            "@starwind-ui/astro/toggle",
            "@starwind-ui/astro/toggle-group",
            "@starwind-ui/astro/tooltip",
            "tailwind-variants",
            "convex/react",
            "fuse.js",
            "markdown-it",
            "@octokit/rest",
            "astro/app/manifest",
            "astro/logger/json",
            "@astrojs/rss",
          ],
        },
      },
    },
  },

  markdown: {
    shikiConfig: {
      themes: {
        light: 'min-light',
        dark: 'min-dark',
      },
      wrap: true,
    },
    // Astro 7 defaults to the native Sätteri pipeline, which has no remark/rehype
    // support and no built-in external-link handling. Stay on the unified
    // (remark/rehype) processor so the plugins below keep working unchanged.
    processor: unified({
      remarkPlugins: [remarkReadingTime],
      rehypePlugins: [
        [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
        rehypeImageSize,
      ],
    }),
  },

  // Cal Sans (cal-sans npm package, OFL), trimmed to Latin characters with
  // a fixed optical size; weights 400-700 stay variable. Upright is
  // preloaded; italic only downloads on pages that use it.
  fonts: [{
    provider: fontProviders.local(),
    name: "Cal Sans",
    cssVariable: "--font-cal-sans",
    options: {
      variants: [
        { src: ["./src/assets/fonts/CalSans-Upright.woff2"], weight: "400 700", style: "normal" },
        { src: ["./src/assets/fonts/CalSans-Italic.woff2"], weight: "400 700", style: "italic" },
      ],
    },
  }],

  adapter: cloudflare(),
});