// @ts-check
import { defineConfig, fontProviders, envField } from 'astro/config';
import sitemap from "@astrojs/sitemap";
import react from '@astrojs/react';
import pagefind from "astro-pagefind";



import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import { remarkReadingTime } from './src/utils/remark-reading-time.mjs';


import tailwindcss from '@tailwindcss/vite';

import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  site: "https://beckyschmidt.me",
  integrations: [
    sitemap({ filter: (page) => page !== 'https://beckyschmidt.me/admin' }), 
    react(),
    pagefind()
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
        context: "client",
      }),
      GITHUB_REPO: envField.string({
        access: "public", 
        context: "client",
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
    remarkPlugins: [
      [remarkToc, { tight: true }],
      [remarkCollapse, { test: 'Table of contents' }],
      remarkReadingTime,
    ],
  },

  experimental: {
  fonts: [{
    provider: fontProviders.fontsource(),
      name: "Carlito",
    cssVariable: "--font-carlito",
    weights: ["400", "700"]
    }]
  },

  adapter: netlify(),
});