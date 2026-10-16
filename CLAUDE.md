# CLAUDE.md

Personal site for Becky Schmidt (beckyschmidt.me). Astro 7 + Tailwind 4 + React islands, deployed to **Cloudflare Workers** (not Netlify — older docs/history may say otherwise). Includes a GitHub-API-backed admin CMS at `/admin` and Convex-powered note reactions.

## Commands

- `npm run astro-dev` — Astro dev server only (**prefer this for agents**)
- `npm run dev` — also spawns `convex dev` in the background
- `npm run check` — `astro check` (typecheck; there are no tests or linter — this is the verification step)
- `npm run build` — production build
- `npm run deploy` — build + `wrangler deploy` (**never run unless explicitly asked**)
- **Pushing to `master` auto-deploys** the live site via Cloudflare's Git integration, so a push is a production release: only push when asked, and there's no need for `npm run deploy` afterward. (CMS PRs merged into `master` go live the same way.)

## Where things live

| What | Where |
|---|---|
| Notes (blog content) | `src/notes/*.md` — collection schema in `src/content.config.ts` |
| Homepage copy | `src/story/*.md` (imported directly by `src/pages/index.astro`) |
| Projects list | `src/data/projects.json` (schema-validated collection via `file()` loader) |
| Mini tools | List: `src/data/mini-tools.json` (collection `miniTools`; shown on `/mini-tools` and in search). Each tool is a page in `src/pages/mini-tools/`. CleanShot's logic lives in `src/lib/cleanshot/` (pure canvas modules + `app.ts` for page behavior) |
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
- **Starwind UI** (CleanShot only so far): components in `src/components/starwind/`, theme in `src/styles/starwind.css`, which maps Starwind's tokens onto the site palette and is imported by `global.css` (not a second Tailwind entry). Starwind buttons own their disabled state: use `createButton(el).setDisabled()` from `@starwind-ui/runtime/button`, never `el.disabled =`.
- **Machine-readable endpoints**: `rss.xml.ts`, `robots.txt.ts`, `llms.txt.ts`, `llms-full.txt.ts`, `search-index.json.ts` in `src/pages/` — keep their facts in sync with `siteConfig.ts` when identity/stack details change.

## Link vocabulary

Four link/interaction roles, each with ONE treatment. Don't invent a fifth; when adding a link, pick its role and copy an existing example.

1. **Content links** (in prose and story copy): underlined at rest — `underline decoration-1 underline-offset-2 decoration-foreground/30`, the link keeps the surrounding text color, and text and decoration go to full foreground on hover. This is the default `a` style in both `.typography` and `.type-standard` (`src/styles/global.css`); a plain `<a>` gets it for free.
2. **Titles of clickable list items** (homepage project rows, NotesReel note titles, mini tools list): regular weight in `text-primary` (a softer white in dark mode), no underline at rest; on hover the title goes to full foreground and underlines (`group-hover:text-foreground group-hover:underline`). Their descriptions and dates are `text-sm text-faint-foreground`. The row itself is `no-underline!`.
3. **Quiet meta-navigation** ("← all notes" via `AllNotesLink.astro`, "View all (n) →", tag chips): small muted text, `no-underline!`, hover signals by color only — `text-muted-foreground! hover:text-foreground!` (chips use a background tint change instead). The `!` on colors is required to beat the `.typography a` prose rule on note pages.
4. **Navigation chrome** (navbar icon buttons): pill hover — `rounded-lg hover:bg-foreground/13`. Buttons only, never text links.

External links additionally get the outbound icon via `.typography a[href^="http"]` (`global.css`). Inside an `.icon-links` wrapper, a content link that starts with a favicon `<img>` from `public/tool-icons/` shows that icon instead of the outbound one (markdown: `[![](/tool-icons/name.png)Name](https://…)`).

When to use an icon instead of the outbound arrow:
- **Icon**: a set of named tools or services the reader recognizes or chooses between (the colophon's tool list, the homepage contact links). Every link in the set gets one, never a lone icon, and only with a recognizable mark that reads in both light and dark mode.
- **Brand favicon in the homepage intro**: the employer, project and contact links in the intro get their favicon (`public/tool-icons/` or `public/project-icons/`). Keep it to named brands and products; never on generic links or on passing mentions (e.g. the integration partners in the intro sentence). If a logo has an official dark-mode version, swap it via `content: url()` in `global.css` rather than inverting.
- **Outbound arrow** (the default): any other link inside a sentence that's telling a story, i.e. notes and most copy.

## Conventions & gotchas

- Headings: on standard pages (`.type-standard`: home, notes index, tag pages, 404) a plain `<h1>`/`<h2>` is 20px regular in full foreground, one step above everything else; body text is muted gray. The whole site uses regular weight; only `<strong>` in notes is bold — don't add size classes. Notes and the colophon use `.typography`, which keeps large headings.
- Path alias `@/*` → `src/*`. Tailwind 4 via the Vite plugin — there is no `tailwind.config`; design tokens live in `src/styles/global.css`.
- Env vars are declared in `astro.config.mjs` `env.schema` and read via `astro:env/client|server`. Local values in `.env.local` (gitignored; never print it). `convex dev` writes `CONVEX_DEPLOYMENT`/`CONVEX_SITE_URL` there automatically.
- Client components (`.tsx` islands) must not import server-only modules (`astro:content`, `src/lib/github.ts`, `src/lib/notes.ts`).
- Dev-server "The file does not exist at node_modules/.vite/deps_ssr/…" or "Invalid hook call" errors mean Vite found a package late and re-bundled mid-session. The fix is to add that package to the `optimizeDeps.include` lists in `astro.config.mjs` (browser list, or `environments.ssr` for server-rendered imports), not to restart. Check `npx astro dev logs` for "dependency optimized: …" to see which one.
- `NoteEditor.tsx` contains delicate mobile-viewport/scroll workarounds (see its inline comments) — edit conservatively.
- Verification = `npm run check` then `npm run build`. Don't commit, push, or deploy unless asked.
