---
title: "The new prototype"
slug: "the-new-prototype"
pubDate: "2026-07-11"
author: "Becky Schmidt"
description: ""
tags: ["product-management","day-job"]
---

Prototyping is one of my favorite parts of the product manager job. It's the best bridge between engineering and non-technical stakeholders (customer success, CEO, etc.) and is effectively dream building - an idea turning into something you can actually touch and feel (metaphorically...I imagine this feeling is even more powerful in physical product prototyping).

Prototyping has always been a part of the PM job, but fidelity expectations have changed. The product I work on has both data & UI components, and each have different surfaces. Before AI, a good data prototype for me was a limited SQL query output in a Google Sheet, maybe even with a pivot table or a graph. A decent UI prototype was either a wireframe or a Frankensteined Miro board of various screenshots of our existing app & borrowed features from other platforms I liked.

With AI, that's all changed. Of course that's still possible, but the bar has raised significantly, I believe for the better.

What is the goal of prototyping? My definition would distill it down to this:

** *A good prototype takes an idea and quickly turns it into something you can feel, touch, and react to. It is not a final product, but rather an artifact that you can produce in a small amount of time to represent what a final product could look like, to get closer to an agreed upon final specification.* **

Given that framework, the starting point is the idea. Half-baked ideas warrant half-baked prototypes. One of the worst versions of prototyping is when you've prototyped in completely the wrong direction. As the idea hardens, so can the prototype, and the end result is an agreed upon artifact that can then be hardened into a production-level product or feature.

Today with AI, prototyping speed has decreased from weeks or days to hours. Since prototyping is so fast now, I've found myself falling into the trap I described above of taking a half-baked idea and turning it into a polished prototype, just for all of us to realize that the time would've been better spent fleshing out the idea. Even though it may only take half a day, it's still a waste of time if you didn't understand the assignment.

The surface has also changed. I've started moving more of my prototyping to HTML. I was using v0 and other "app builders" for prototyping initially, but I dont need a backend database or a Next.js app so it just became overkill. My favorite way to start is by sketching out my idea literally or just conceptually with Claude Code, sharing screenshots, and then starting with a clickable HTML. Now with the BigQuery MCP I am able to put real, static data into the file so demos feel real. 

Maybe surprisingly, once the prototype passes the HTML test, the UI will still move back to Figma for multi-player review. I hope this will be solved soon, but it's much easier to share, iterate, and give feedback in Figma right now than on static HTML files. The whole Claude artifact system isn't working well for this use case.

Most recently we've been prototyping Media Mix Modeling. With AI, I've been able to take real data, run it through a real MMM, and produce HTML files that stylistically are close enough to our design style to make it feel extremely high fidelity. This idea has existed for a few years so there was plenty of source material to pull from, and Claude Fable effectively oneshot the first prototype. From there, the challenge was no longer pixel pushing, but turning all these overwhelming data points into a concise, cohesive story.

I used to love prototyping and I still do. Before AI, I spent the majority of my time fighting with software to get something semi-presentable together. Today, the focus has shifted from simply creating something to steering. Every good prototype has an idea behind it, and now those clarity of the ideas matter more than just presenting something. AI can pump out 10 prototypes in the time I could've made one, but now good prototypers are having to iterate faster on the underlying idea and final positioning, rather than focusing on dragging elements around.
