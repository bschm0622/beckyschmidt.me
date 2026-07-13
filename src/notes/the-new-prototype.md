---
title: "The job was never the prototype"
slug: "the-job-was-never-the-prototype"
pubDate: "2026-07-14"
author: "Becky Schmidt"
description: ""
tags: ["product-management","day-job","AI"]
---

I have always loved the moment in product management where an idea becomes something you can react to. A conversation that has been stuck in hypotheticals suddenly has a shape. A customer problem becomes a workflow. A vague direction becomes a screen someone can point at and say, "Yes, but what about this?"

That is what makes prototyping so powerful: it changes the quality of the conversation. It is not about making a pretty mockup. It is about giving a team something concrete enough to disagree with.

For most of my career, getting there required a fair amount of duct tape. I built wireframes out of screenshots in Miro, created data concepts in Google Sheets, and spent a lot of time explaining what people should ignore because the prototype wasn't real yet. Now with AI, I can create a realistic prototype with real data in a fraction of the time. But the surprising thing is that the biggest change hasn't been the speed. It is that I have had to get much better at deciding what is worth prototyping in the first place.

## Better prototypes create better conversations

Before AI, I was building wireframes that required quite a bit of imagination, due to limitations of the tools. "There would be a button here, ignore the stuff I copied from another site's UI, this data isn't real but this is what it would be like", etc. But today, with AI, you can create very high-fidelity mockups, data prototypes, and artifacts, very quickly. My favorite workflow now is to give Claude screenshots of our existing UI, connect it to BigQuery through MCP, and let it build a clickable HTML prototype using real data.

Now when I get into those stakeholder meetings where we're reviewing an initial prototype, the conversations are much richer. Rather than spending half of the time nitpicking frankensteined screenshots or synthetic data, we're actually discussing the product.

Interestingly, once an HTML prototype reaches a certain level of maturity, I often move it back into Figma. HTML has become my favorite surface for creating prototypes, but Figma is still the best place to review them as a team. Commenting, collaborating, and iterating together is still much easier there. AI has changed how I build prototypes, but teams still need a shared surface to work off of.

## Working towards clarity

As AI made generation easier, I realized my job wasn't generating anymore. It was making better decisions about what to generate in the first place. That showed up in two ways: prototyping the wrong idea, and prototyping too many ideas.

Because AI can produce something polished so quickly, it's tempting to skip ahead to the prototype before I've really clarified the problem. I've caught myself spending half a day iterating on an interface only to realize I was answering the wrong question. AI removed a lot of the friction from prototyping, but it didn't remove the need for discovery or thoughtful product thinking.

The second trap is volume. I used to spend half of my prototyping time fighting the tools just to get something decent in front of stakeholders. Now, in less time, I can generate five or ten believable directions. At first, I presented all of them simply because I could. What I learned is that stakeholders don't actually want the buffet - they want the tasting menu. Two to four well-considered options with a clear point of view are far more useful than ten possibilities.

A perfect example of this happened recently. We’ve had a dream of introducing marketing mix modeling (MMM) into our platform for years, but never had the bandwidth to build it. When Anthropic’s Fable model dropped, it felt like the perfect opportunity to tackle an ambitious prototype that would have been unrealistic a year ago.

I was blown away when Fable essentially one-shot a working MMM prototype, serving up an HTML mockup complete with realistic spend curves and projections. But the immediate roadblock wasn't technical capacity; it was cognitive overload. The model generated a single file with over 30 charts. It was overwhelming. Then the real product work started - parsing through those 30 charts, finding the "so what," and distilling a chaotic mountain of data into a cohesive story our customers could actually use.

A year ago, the hardest part of product development was simply getting to the point where you had something to react to. Today, that’s the easy part. The real challenge is making sure we’re building the right thing to react to in the first place.
