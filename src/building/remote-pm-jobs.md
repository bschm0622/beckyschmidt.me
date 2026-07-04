---
title: "A job board that runs itself"
tagline: "A remote PM job board: scraped, enriched by local LLMs, refreshed mostly without me."
order: 1
links:
  - label: "remotepmjobs.com"
    href: "https://remotepmjobs.com?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building"
---

I built [remotepmjobs.com](https://remotepmjobs.com?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building) because I wanted to learn scraping and data enrichment for real, and a job board forces you to take it seriously. If the pipeline breaks, the listings go stale and the whole site is visibly dead within days. I couldn't get away with one-off scripts, so I ended up building an actual system.

Here's what runs today, mostly without me.

## The pipeline

A Python scraper pulls postings straight from the applicant tracking systems of the companies I track, with one adapter per ATS. Seven so far: Greenhouse, Lever, Ashby, Rippling, Gem, Workable, and BambooHR. Postings get upserted into a Turso database by URL, and anything missing from the latest scrape is marked inactive, so closed roles drop off the board automatically.

Then enrichment. Every active job runs through five LLM phases: classification, compensation, a role pitch, skills, and content for the resume matcher. The job-level phases run on a local gemma3 model on the Mac Mini in my house, and the company-level enrichment, the prose and the culture signals, goes to Claude. Scrape, import, and enrich are deliberately three separate layers so each can fail and retry on its own, and every run writes a record I can check when something looks off.

## What it grew into

The board is more than listings now. There's a salary explorer, ranked company lists, and a resume matcher that runs embeddings in your browser, so nobody's resume ever touches my server. And because I kept wondering what an AI agent would want from a job board, it has its own MCP server. An agent can query the listings the same way you'd browse them.

## The vertical I killed

For a while the plan was bigger. The codebase is multi-vertical by design, one environment variable away from becoming a marketing job board too, and that was originally going to be the next launch. Then I did the math on my actual life. My day job is the main thing, my family is growing, and there are only so many evenings. Growing two boards meant growing both of them badly, so the marketing vertical never shipped, and the time it would have taken went into making the PM board better.

The ambition came from reading indie hackers, but honestly, that lifestyle doesn't fit where I am right now, and I don't want it to. A side project is worth it as long as it makes me sharper and fits around my real life. This one still does.

## What it taught me

Reading a few hundred PM job descriptions for this project is what turned into [my essay on agency](/notes/how-to-know-if-you-have-agency). The other lesson was distribution. Building the product turned out to be maybe half the work. The rest has been SEO, learning page by page how people actually find things, because if I didn't figure that out, nobody was going to visit the site no matter how good the pipeline was.
