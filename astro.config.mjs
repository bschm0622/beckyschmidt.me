// @ts-check
import { defineConfig, fontProviders, envField } from 'astro/config';
import sitemap from "@astrojs/sitemap";
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import rehypeExternalLinks from 'rehype-external-links';
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';


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
    plugins: [tailwindcss()]
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
    // (remark/rehype) processor so both plugins below keep working unchanged.
    processor: unified({
      remarkPlugins: [remarkReadingTime],
      rehypePlugins: [
        [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
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