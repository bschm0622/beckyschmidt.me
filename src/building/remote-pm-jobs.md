---
title: "A job board that runs itself"
tagline: "A remote PM job board: scraped, enriched by local LLMs, refreshed mostly without me."
order: 1
links:
  - label: "remotepmjobs.com"
    href: "https://remotepmjobs.com?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building"
---

I built [remotepmjobs.com](https://remotepmjobs.com?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building) because I wanted to learn scraping and enrichment for real, and a job board is an honest way to force the issue. Job boards live or die on freshness. If the pipeline breaks, the product is visibly dead within days, which is exactly the kind of pressure that turns scripts into systems.

Here's what runs today, mostly without me.

## The pipeline

A Python scraper pulls postings straight from the applicant tracking systems of the companies I track, with one adapter per ATS. Seven so far: Greenhouse, Lever, Ashby, Rippling, Gem, Workable, and BambooHR. Postings get upserted into a Turso database by URL, and anything missing from the latest scrape is marked inactive, so closed roles walk themselves off the board.

Then enrichment. Every active job runs through five LLM phases: classification, compensation, a role pitch, skills, and content for the resume matcher. The job-level phases run on a local gemma3 model on the Mac Mini in my house, and the company-level enrichment, the prose and the culture signals, goes to Claude. Scrape, import, and enrich are deliberately three separate layers so each can fail and retry on its own, and every run writes a record I can check when something looks off.

## What it grew into

The board is more than listings now. There's a salary explorer, ranked company lists, and a resume matcher that runs embeddings in your browser, so nobody's resume ever touches my server. And because I kept wondering what an AI agent would want from a job board, it has its own MCP server. An agent can query the listings the same way you'd browse them.

## The vertical I killed

For a while the plan was bigger. The codebase is multi-vertical by design, one environment variable away from becoming a marketing job board too, and for a while that was the plan. Then I did the math on my actual life. My day job is the main thing, my family is growing, and the evening hours left over are very much not infinite. Two boards meant growing both badly, so the marketing vertical never shipped, and everything it would have cost went into making the PM board better.

I picked up the ambition from reading indie hackers. The correction came from running the numbers on my own weeks: a side project earns its keep by making me sharper, and the moment it starts competing with the life it's supposed to fit around, it loses.

## What it taught me

Reading a few hundred PM job descriptions for this project is what turned into [my essay on agency](/notes/how-to-know-if-you-have-agency). The other lesson was distribution. Building the product was maybe half the work; the rest has been SEO, page by page, learning how people actually find things. Nobody assigns you distribution. You figure it out or nobody shows up.
