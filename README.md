# beckyschmidt.me

Personal site for Becky Schmidt — Senior PM, builder, and writer.

Live at [beckyschmidt.me](https://beckyschmidt.me).

## Stack

- **Astro 6** — static site generation
- **React** — interactive components
- **Tailwind CSS 4** — styling
- **Convex** — real-time reactions on posts
- **Netlify** — hosting and serverless functions
- **GitHub API** — headless CMS via custom admin

## Features

- Custom admin at `/admin` — write posts, manage branches, create PRs
- `⌘K` search powered by Pagefind
- Real-time post reactions via Convex
- Dark/light mode
- RSS feed, sitemap, structured data

## Environment Variables

```bash
CONVEX_URL=your_convex_deployment_url
ADMIN_PASSWORD=your_admin_password
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
```

## Commands

| Command             | Action                                  |
| :------------------ | :-------------------------------------- |
| `npm install`       | Install dependencies                    |
| `npm run dev`       | Start Convex + Netlify dev server       |
| `npm run astro-dev` | Astro dev only (no Convex)              |
| `npm run build`     | Build to `./dist/`                      |
| `npm run preview`   | Preview build locally                   |

## Content

- Posts live in `src/content/blog/` as Markdown files
- Edit bio in `src/content/intro.md`
- Edit projects in `src/data/projects.json`
- Edit work history in `src/content/resume/`
- Site config (socials, nav) in `src/siteConfig.ts`
