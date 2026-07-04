---
title: "This site, and the tools behind it"
tagline: "I built the CMS I publish with and the tools I write with."
order: 3
links:
  - label: "editor.beckyschmidt.me"
    href: "https://editor.beckyschmidt.me?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building"
---

The site you're reading is a fairly normal Astro site. The part I actually built is everything behind the writing.

Publishing from a static site usually means editing markdown in a code editor and pushing commits, which is enough friction to kill a writing habit. So I built myself a small CMS: an admin dashboard behind a login on this very site, where I draft and publish notes, and when I hit publish it opens a pull request against the site's GitHub repo. The commit history literally says "via CMS." An audience of one, fully served.

Writing with AI in the loop also means a lot of markdown flying between chat windows and files, so I built [editor.beckyschmidt.me](https://editor.beckyschmidt.me?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building), a minimal markdown reader where I can actually read drafts and diffs as formatted text instead of raw markup.

None of this needed to exist. Netlify hosts it, Convex powers the little reactions on my notes, and there's an llms.txt so agents can read the site without scraping it. I keep building tools like this because owning the whole stack of my own writing changed how I spec tools for other people at work. It's much harder to hand-wave a requirement after you've been your own user, your own engineer, and your own support team on a Tuesday night.
