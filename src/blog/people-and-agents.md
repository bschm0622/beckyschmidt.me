---
title: "People and agents"
slug: "people-and-agents"
pubDate: "2026-05-06"
author: "Becky Schmidt"
description: ""
tags: ["AI","side-project"]
---
About a month ago, I wrote [this post](https://beckyschmidt.me/notes/testing-local-ai-models/) about downloading Gemma, an open weight AI model, onto my Mac Mini and using it to enrich job posts on my newest side project, [remotepmjobs.com](https://remotepmjobs.com?ref=beckyschmidt.me). Ever since then, I've been tinkering on the site - making UX improvements, optimizing for SEO, adding more companies, and working on company-level enrichment.

All of these improvements were fun and have been slowly increasing my traffic, but I felt like I wasn't making anything super special. The moat so far was the data, and for the record, that is a pretty good moat. But there had to be more.

After some late night scrolling on X, I finally found it. In this new world, you now have 2 users: people AND agents. People interact with your UX, want things to be easy to read and intuitive. Agents want structured, accessible data, and that's it. So I decided, why not make an MCP?

If you haven't run into the term, MCP (Model Context Protocol) is essentially a way to plug a data source directly into an AI assistant like Claude or Cursor. Once you connect it, the assistant can query your data on its own, mid-conversation, and use the results to answer the user in plain English. Think of it like an API, except it's designed for an AI to consume rather than a developer.

With Claude Code, building one was pretty easy. The data was already structured from all the enrichment work I'd been doing, so the MCP itself is mostly a thin wrapper - five tools that let Claude search jobs, look up a single role, browse companies, get a company profile, and check what filter values are valid. Claude does the rest: it picks the right tool, fills in the filters from your question, and turns the result into a plain-English answer with links back to the listings. You never see the JSON.

The most exciting part about all of this is that I built it solo, in an evening, and I genuinely don't think it would make the same kind of sense for an Ashby or a Greenhouse to release. They have way more data than me. But their differentiator is the platform - the ATS itself - not the data sitting inside it. Mine is the data, cleaned and structured and categorized. So when an MCP lets an agent query that data directly, it's my edge that gets sharper, not theirs. The same thing that makes the moat hard to build (all the enrichment, all the cleaning) is what makes the MCP useful in the first place.

With my MCP, you can ask Claude things like, "which AI-native companies are hiring multiple PMs right now?" or "find me senior growth PM roles at Series B companies paying over $180k, where I won't have to manage people," or "tell me about Postscript as a remote-PM employer and what roles they have open" - and it'll come back with real answers from my board, with links. Pretty incredible stuff. You can try it here: [https://remotepmjobs.com/mcp](https://remotepmjobs.com/mcp).

The bigger point I'd make to anyone building anything on the web right now is: you have to do both. SEO discovery still matters - humans aren't going anywhere, and most of them still find things by searching. But making your data agent-reachable matters now too, and it's easier than you'd expect if you've already done the work to make your data clean. The teams that win the next stretch of the web aren't going to be the ones who pick a side, they're going to be the ones who do both. And if you're a small builder sitting on good data, I don't know that there's been a better moment to ship something.
