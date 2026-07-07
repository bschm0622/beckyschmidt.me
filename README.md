# beckyschmidt.me

Personal site for Becky Schmidt — Senior PM, builder, and writer.

Live at [beckyschmidt.me](https://beckyschmidt.me).

## Stack

- **Astro 6** — content site with server endpoints (Netlify adapter)
- **React** — interactive islands (search, reactions, admin editor)
- **Tailwind CSS 4** — styling (via `@tailwindcss/vite`, no config file)
- **Convex** — real-time reactions on notes
- **Netlify** — hosting + serverless functions
- **GitHub API** — headless CMS: the `/admin` editor commits Markdown to this repo

## Features

- Custom admin at `/admin` — write notes, upload images, manage branches, open PRs
- `⌘K` search powered by **Fuse.js** over a prebuilt `/search-index.json`
- Real-time note reactions via Convex
- Dark / light mode with no flash across view transitions
- RSS feed, sitemap, structured data, and `llms.txt` / `llms-full.txt`

## Environment Variables

Set these in `.env.local` (see `.env.example`) and in the Netlify dashboard:

```bash
CONVEX_URL=your_convex_deployment_url        # public
ADMIN_PASSWORD=your_admin_password           # secret — also signs admin session cookies
GITHUB_TOKEN=your_github_personal_access_token  # secret
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
```

They're declared and validated in `astro.config.mjs` (`env.schema`) and read via `astro:env`.

## Commands

| Command             | Action                                  |
| :------------------ | :-------------------------------------- |
| `npm install`       | Install dependencies                    |
| `npm run dev`       | Start Convex + Netlify dev server       |
| `npm run astro-dev` | Astro dev only (no Convex)              |
| `npm run build`     | Build to `./dist/`                      |
| `npm run preview`   | Preview build locally                   |

## Content

All copy is Markdown or JSON — no CMS database:

- **Notes** live in `src/notes/` as Markdown (the `notes` content collection; schema in `src/content.config.ts`)
- **Homepage copy** in `src/story/{hero,beliefs,contact}.md`
- **Projects** in `src/data/projects.json`
- **Site config** (title, socials, nav) in `src/siteConfig.ts`

Note images are committed to `public/notes-images/<slug>/` by the admin uploader.

## Project structure

```
src/
  layouts/     BaseLayout (html shell) → DefaultLayout / NoteLayout / AdminLayout
  pages/       routes; /notes/* is the blog, /admin* is the editor, api/* are endpoints
  pages/api/   auth + GitHub endpoints (all /api/github/* require an admin session)
  components/  Navbar, SearchModal + FuseSearch, NotesReel, reactions, NoteEditor
  lib/         session.ts (admin auth), github.ts (Octokit + env)
  notes/       Markdown notes (the content collection)
  story/       homepage sections
  utils/       remark/rehype plugins, slugify, client-side image processor
```

## Admin auth

`/admin` posts the password to `/api/auth`, which sets a signed, HttpOnly session
cookie (HMAC keyed on `ADMIN_PASSWORD`). Every `/api/github/*` route calls
`requireAuth` and returns 401 without a valid session. See `src/lib/session.ts`.
