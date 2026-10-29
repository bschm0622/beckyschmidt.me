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

export default defineConfig({
  site: "https://beckyschmidt.me",

  redirects: {
    "/notes/building-a-shared-agent-editor": "/notes/how-i-built-a-shared-agent-editor",
  },

  // Astro 7 defaults to 'jsx' whitespace stripping; true keeps v6's HTML output.
  compressHTML: true,

  integrations: [
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/admin') }),
    react()
  ],
    

  env: {
    schema: {
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
    // Pre-bundle every imported package; a late Vite re-bundle breaks dev ("file does not exist at
    // .vite/deps_ssr", "Invalid hook call"). Add any newly imported package here.
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
            "fuse.js",
            "markdown-it",
            "@octokit/rest",
            "astro/app/manifest",
            "astro/logger/json",
            "astro/content/runtime",
            "astro/virtual-modules/transitions.js",
            "astro > @oslojs/encoding",
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
    // Astro 7's default Sätteri pipeline has no remark/rehype support; stay on unified.
    processor: unified({
      remarkPlugins: [remarkReadingTime],
      rehypePlugins: [
        [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
        rehypeImageSize,
      ],
    }),
  },

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