# CLAUDE.md

Personal site for Becky Schmidt (beckyschmidt.me). Astro 6 + Tailwind 4 + React islands, deployed to **Cloudflare Workers** (not Netlify — older docs/history may say otherwise). Includes a GitHub-API-backed admin CMS at `/admin` and Convex-powered note reactions.

## Commands

- `npm run astro-dev` — Astro dev server only (**prefer this for agents**)
- `npm run dev` — also spawns `convex dev` in the background
- `npm run check` — `astro check` (typecheck; there are no tests or linter — this is the verification step)
- `npm run build` — production build
- `npm run deploy` — build + `wrangler deploy` (**never run unless explicitly asked**)

## Where things live

| What | Where |
|---|---|
| Notes (blog content) | `src/notes/*.md` — collection schema in `src/content.config.ts` |
| Homepage copy | `src/story/*.md` (imported directly by `src/pages/index.astro`) |
| Projects list | `src/data/projects.json` (schema-validated collection via `file()` loader) |
| Site identity/meta (name, email, socials, job title, OG image, analytics id, theme colors, RSS metadata, nav) | `src/siteConfig.ts` — the single source of truth; don't hardcode these elsewhere |
| Note images | `public/notes-images/<slug>/` |
| Prose style guide | `writing-style.md` — follow it when drafting notes or site copy |

## Architecture

- **Layouts** (3): `BaseLayout` (html shell + `BaseHead`) → `DefaultLayout` (Navbar + main + SearchModal; props `proseClass`, `fullWidth`, `noSearch`) → `NoteLayout` (composes DefaultLayout; article header, JSON-LD, reactions).
- **Note URLs**: `post.id` (the filename) is the only source of truth — there is no `slug` frontmatter field. Helpers: `getSortedNotes()` / `noteUrl()` in `src/lib/notes.ts` (server-only).
- **`src/lib/`** is the shared-code home (there is no `src/utils/`):
  - `notes.ts` — note fetching/sorting/URLs (server-only; imports `astro:content`)
  - `slugify.ts` — slugify + `formatDate` (client-safe)
  - `frontmatter.ts` — the ONE frontmatter parser/serializer, isomorphic; used by API routes, the editor, and the search index. Never write another frontmatter regex.
  - `constants.ts` — `DEFAULT_BRANCH`, `CMS_BRANCH_PREFIX`, `NOTES_DIR` (isomorphic)
  - `http.ts` — `json()` response helper
  - `github.ts` — Octokit setup + `githubRoute()` wrapper (server-only)
  - `session.ts` — cookie auth; `requireAuth()`
  - `cms-api.ts` — typed client for `/api/github/*`; the single client↔server contract, plus `publishNote()` / `deleteNotePipeline()` flows
  - `images.ts` — image validation/optimization constants + helpers
- **Admin CMS**: pages in `src/pages/admin/`, React islands `AdminDashboard.tsx` and `NoteEditor.tsx` (UI only — all IO goes through `cms-api.ts`). API routes in `src/pages/api/github/` are each a thin `githubRoute()` handler; auth is enforced by the wrapper. CMS edits create `cms/…` branches and PRs against `master`.
- **Convex**: functions in `convex/` (`reactions.ts`, `schema.ts`); `convex/_generated/` is generated — never hand-edit.
- **Machine-readable endpoints**: `rss.xml.ts`, `robots.txt.ts`, `llms.txt.ts`, `llms-full.txt.ts`, `search-index.json.ts` in `src/pages/` — keep their facts in sync with `siteConfig.ts` when identity/stack details change.

## Conventions & gotchas

- Path alias `@/*` → `src/*`. Tailwind 4 via the Vite plugin — there is no `tailwind.config`; design tokens live in `src/styles/global.css`.
- Env vars are declared in `astro.config.mjs` `env.schema` and read via `astro:env/client|server`. Local values in `.env.local` (gitignored; never print it). `convex dev` writes `CONVEX_DEPLOYMENT`/`CONVEX_SITE_URL` there automatically.
- Client components (`.tsx` islands) must not import server-only modules (`astro:content`, `src/lib/github.ts`, `src/lib/notes.ts`).
- `NoteEditor.tsx` contains delicate mobile-viewport/scroll workarounds (see its inline comments) — edit conservatively.
- Verification = `npm run check` then `npm run build`. Don't commit or deploy unless asked.
