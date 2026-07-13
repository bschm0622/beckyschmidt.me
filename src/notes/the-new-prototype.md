---
title: "The job was never the prototype"
slug: "the-job-was-never-the-prototype"
pubDate: "2026-07-14"
author: "Becky Schmidt"
description: ""
tags: ["product-management","day-job","AI"]
---

Prototyping is one of my favorite parts of the product manager job. It's the bridge between ideas & reality, and gives everyone in the room something to feel, touch, and react to. Just a few years ago prototyping took quite a bit of time and effort, but now anyone can send a prompt to their favorite AI chatbot and get a really polished artifact to share around. So if everyone can create prototypes, it begs the question - what is the specific value that a product manager brings to prototyping? 

AI didn't change the purpose of prototyping. It changed what the PM gets to spend their time on.

## Better prototypes create better conversations

A prototype exists to create understanding and invite feedback, not to be production-ready.

Before AI, I was building wireframes in Miro, data concepts in Google Sheets, and it required quite a bit of imagination. "There would be a button here, ignore the stuff I copied from another site's UI, this data isn't real but this is what it would be like", etc. But today, with AI, you can create very high-fidelity mockups, data prototypes, and artifacts, very quickly. My favorite workflow now is to give Claude screenshots of our existing UI, connect it to BigQuery through MCP, and let it build a clickable HTML prototype using real data.

Now when I get into those stakeholder meetings where we're reviewing an initial prototype, the conversations are much richer. Rather than spending half of the time nitpicking frankensteined screenshots or synthetic data, we're actually discussing the product.

Interestingly, once an HTML prototype reaches a certain level of maturity, I often move it back into Figma. HTML has become my favorite surface for creating prototypes, but Figma is still the best place to review them as a team. Commenting, collaborating, and iterating together is still much easier there. AI has changed how I build prototypes, but not how teams align around them.

The quality of a prototype has always depended less on the person drawing the interface than on the thinking behind it. The best prototypes come from deeply understanding the customer problem, the business context, and the technical constraints. AI can generate a beautiful interface. It can't decide which tradeoffs matter.

Of course, faster prototyping doesn't automatically lead to better products. AI makes it just as easy to prototype the wrong idea. The quality of the artifact still depends on the quality of the thinking behind it. And if you think about it like that, the job was never to create the prototype, but to create clarity. A prototype is just the fastest way to get there.

## Working towards clarity

I used to spend about half of the prototyping time fighting with the tools to come up with something decent to demo. Now, in half that time with AI, I'm able to come up with 5-10 ideas. At the beginning of all of this, I was falling into the trap of actually presenting a bunch of different directions just because that door had opened. Even if people *think* they want the buffet, what they really want is the tasting menu: two to four curated options with clear reasoning. The goal isn't to generate more possibilities, but make it easier for a team to choose.

We've had a dream of doing marketing mix modeling (MMM) within our product for a few years now, but never had the resources or bandwidth to do so. With the release of Anthropic's Fable model, we decided to take it for a swing because it was exactly the kind of ambitious prototype that would've been unrealistic for me to build a year ago. I was kind of shocked that Fable actually one-shot an MMM prototype, and gave me an HTML mockup to react to with real spend curves and projections, using real client data.

From there, the challenge was no longer "is this possible?", but turning all these overwhelming data points into a concise, cohesive story. Fable quickly created something we'd been wanting for years, but it produced a massive file that was too overwhelming to share out of the gate. I still needed to comb through the outputs and think through what our customers would do with all this data - the "so what" and "what now" of the data. With an actual model and real client data I was able to have better conversations with stakeholders about the outputs.

AI has made prototypes dramatically easier to build. That's exciting, but it's not the biggest change. The biggest change is that I spend less time constructing artifacts and more time helping a team understand the right problem, evaluate better ideas, and tell a clearer story. If everyone can build prototypes, that's great. It means product managers get to spend less time building artifacts and more time doing the work that was always uniquely theirs: creating clarity.
