---
title: "Testing local AI models"
slug: "testing-local-ai-models"
pubDate: "2026-04-07"
author: "Becky Schmidt"
description: ""
tags: ["ai"]
---
Big labs like Anthropic and OpenAI have been subsidizing our AI subscriptions for years, but that's slowly starting to change. At the time of writing, Anthropic started throttling usage at peak hours. For now, OpenAI is taking the opposite approach by constantly resetting usage limits, but eventually it'll catch up to them too.

On X, there's a lot of hype around using open source, local models to offset increasing token costs. I decided to use my newest project, [Remote PM Jobs](https://remotepmjobs.com?ref=beckyschmidt.me), to try it out for myself. Conveniently, I had already bought a Mac Mini months earlier for completely unrelated reasons, right before the [OpenClaw](https://openclaw.ai) hype took off. OpenClaw is a personal AI assistant that runs on your own machine, and it's been driving a lot of people to pick up Mac Minis specifically for running local models. So I had a great machine sitting ready without even planning for it. This past week, [Gemma 4](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/) from Google dropped, so that's where I started.

## What's the project?

Remote PM Jobs is a pretty simple concept - it's a job board scraper, pulling from ATS systems like Greenhouse, Ashby, Lever, etc. via their official APIs. Every day, an automated workflow fetches job postings, filters for product management roles only, and stores them in Convex.

The second step is AI enrichment and summarization. Rather than just sending users straight to the job posting, I wanted to create some helpful tags - seniority, focus area, salary, benefits, etc. I was initially using Gemini 2.5 Flash Lite for this, which is already [extremely cheap](https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-lite), but I wanted to explore using a local model to bring my enrichment cost down to basically zero.

## Gemma 4

I got Gemma running on my Mac Mini by downloading Ollama, then pulling down the Gemma E4B model. From there, I wrote a local script using Codex - OpenAI's coding agent - that fetches job descriptions from Convex and feeds them into Gemma.

The script runs three separate enrichment passes, and that structure was intentional. Smaller models get confused when you give them too much to do at once - they lose focus, skip things, or just produce muddled output. You also end up needing a lot of negative prompting to keep them on track, which compounds the problem when you're asking them to do several things in one go. Breaking it into focused passes fixes that. First pass: basic classification like seniority, product area, PM type, and geo restrictions. Second: compensation details including benefits and any stated salary ranges. Third: a full read of the job description to summarize what makes the role interesting or differentiated.

Compared to Gemini 2.5 Flash Lite, Gemma was a little worse out of the box. Gemini is more intuitive and needed less hand-holding. Gemma required more explicit guidance to get to the same place. But that tradeoff was worth it to me - the process of tightening up my prompts for Gemma actually made the whole enrichment pipeline better. And being able to run it hundreds of times while iterating without fear of running up a bill is pretty underrated.

Gemma is also slower than hitting an API endpoint, but that doesn't really matter when I'm only enriching a handful of jobs per day.

## Are local models worth it?

For this type of focused enrichment task, yes - 100%. The cost savings are obvious, but the real surprise was how much more freely I could experiment. No API bill watching means you can actually stress-test your prompts instead of being precious about it.

I doubt Gemma would hold up on more complex coding tasks - that's still Codex and Claude territory for me. But I want to find out where the line actually is. That's the next test.