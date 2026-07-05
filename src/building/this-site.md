---
title: "This site, and the tools behind it"
tagline: "I built the CMS, editor, and publishing workflow that powers this site."
order: 3
links:
  - label: "editor.beckyschmidt.me"
    href: "https://editor.beckyschmidt.me?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building"
---

The site you're reading is a fairly normal Astro site, but the tooling behind the writing is homemade, and that's the part worth explaining.

Publishing from a static site usually means editing markdown in a code editor and pushing commits, which is enough friction to kill a writing habit. So I built myself a small CMS: an admin dashboard behind a login on this very site, where I draft and publish notes, and when I hit publish it opens a pull request against the site's GitHub repo. The commit history literally says "via CMS."

Writing with AI in the loop also means a lot of markdown flying between chat windows and files, so I built [editor.beckyschmidt.me](https://editor.beckyschmidt.me?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building), a minimal markdown reader where I can actually read drafts and diffs as formatted text instead of raw markup.

None of this strictly needed to exist. Netlify hosts it, Convex powers the little reactions on my notes, and there's an llms.txt so agents can read the site without scraping it. But owning the whole stack of my own writing has changed how I spec tools for other people at work. It's a lot harder to hand-wave a requirement once you've been the user, the engineer, and the support team for your own product.
