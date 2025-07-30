// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from "@astrojs/sitemap";

import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: "http://localhost:4321",
  integrations: [sitemap()],
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
    ],
  },
  experimental: {
  fonts: [{
    provider: fontProviders.fontsource(),
      name: "Carlito",
    cssVariable: "--font-carlito"
    }]
  }
});