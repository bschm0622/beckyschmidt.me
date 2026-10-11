---
title: "How I built remotepmjobs.com"
pubDate: "2026-10-02"
description: "How I built Remote PM Jobs, a job board that scrapes 1,000+ company job boards every night and enriches the listings with a local AI model."
author: "Becky Schmidt"
tags: ["side project"]
---

I launched Remote PM Jobs in April of 2026. I built it as I started wondering what other jobs might be out there, and found that the current remote product manager job boards were either sparse, not 100% remote, or not product manager focused. I also was getting more interested in local AI and had recently acquired a Mac Mini, so I had the compute available to start testing new capabilities.

## Product Overview

Remote PM Jobs is a job board for product managers. Every night it scrapes 1,000+ company job boards for product manager positions. Using Gemma e12:b (more on that in the building section), it enriches up to 200 jobs per night, and then rebuilds the entire site each day so it's fresh for the next morning. I also built a resume matcher that reviews an uploaded resume against all the live job postings and returns the top 10 matches compared to experience.

## Building

I've primarily used Claude Code and Codex to create the job board. It's using the Astro web framework, Turso for the database, Starwind for UI components, and beehiiv for the newsletter.

Originally the site was hosted on Netlify using Convex, which I was familiar with from building full stack applications. However, I was quickly bottlenecked by their free tiers - the site requires nightly rebuilds which Netlify charges credits for, and Convex's real-time database just didn't really make sense for my use case. With AI it's easy to migrate from one tech stack to the next - within a few days of running into issues with both I migrated to Cloudflare and Turso, both free and sustainable ever since.

Perhaps the most interesting part of this project is the nightly Gemma enrichment. Every night my Mac mini scrapes the ATS's and the postings go through Gemma - to determine if they are remote, and then to enrich them with tags & write the short descriptions. The amazing thing about local AI is that it gives you virtually unlimited AI capabilities. This has allowed me to experiment with many different prompting techniques, and put the job descriptions through 4+ passes in order to get the highest quality data without paying a compute provider.

## User Acquisition and Activation

Remote PM Jobs has a few acquisition channels. Most traffic comes from AI citations (mostly ChatGPT) and organic search. SEO has not been a great channel, mostly because I honestly have changed the site structure so many times and recently realized that quite a bit of the homepage was not crawlable by Google.

I'm seeing that ChatGPT is citing both my homepage and individual job pages. I've tested asking ChatGPT variations of "what's the best way to find a remote product manager job" and about half of the time, it'll share a link to my site, which is pretty exciting. I've also posted on Reddit, which ChatGPT loves to cite as well.

In general, I choose to acquire audiences via passive SEO for two main reasons. The better-sounding reason is because with search you are reaching people at a high-intent moment - they are literally searching for what you're offering. The other reason is because I just don't have time to try to source backlinks, promote in communities, or run ads, etc. I've been happy with the growth, and since it scratches my own itch of seeing what jobs are out there, I continue to maintain the site, add more companies, and make improvements.

The site also has a companion weekly newsletter hosted on beehiiv. Every week I prompt Claude to write up the newsletter by giving it a broad topic (i.e. interesting fintech roles, highest paying senior roles, etc.) and it scans the new jobs, chooses the most interesting ones, and writes up the newsletter, which I send on Tuesdays. The newsletter has decent engagement and works well to get users to come back to the site.
