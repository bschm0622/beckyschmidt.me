---
title: "Abstractions everywhere"
slug: "abstractions-everywhere"
pubDate: "2026-03-26"
author: "Becky Schmidt"
description: ""
tags: ["AI","product-management"]
---
The new goal is that your users never need to log into your app again.

It's a jarring new reality, considering the last 10+ years were highly focused on UI / UX. Navigation, interaction, reporting, dashboards. Following well-worn UX patterns (Snapchat stories making their way into every single consumer social app), focusing on simplicity, ease of use, and sometimes even beauty. But does that even matter anymore?

Your new user persona is an agent, usually named Claude. Its preferred UX isn't an interface, but an MCP - a series of tool calls prying into the guts of your infrastructure, reporting data out and pushing data back in.

For legacy, bloated SaaS, this is a lifeline. I'll illustrate: my company uses Amplitude for product analytics. I'm a bit embarrassed to say that after having it for over six months, I had only logged in a few times. The UI was overwhelming, and I never made time to configure the reports we needed. Enter the [Amplitude <> Claude connector](https://claude.com/connectors/amplitude). In less than 10 minutes I was able to finally spin up a useful, custom dashboard. Claude turned Amplitude from a software I hated into a tool I actually use.

But what surprised me the most about this connector is that Claude didn't just create an artifact - it created a real dashboard inside Amplitude. And from there I found myself going back into Amplitude directly, using their built-in AI to refine things further, then making a few targeted edits in the UI myself. I didn't start in the product, but I arrived there.

Is this truly the future? I have mixed feelings. I find it hard to believe that all SaaS will be abstracted away to the Claude chat window. Chat isn't the right interface for every single interaction. I think Claude is already trying to fix that by creating interactive artifacts, but my biggest gripe is that as the chat continues, the artifact effectively goes away. That's the same issue I have with Slack and other chat apps. They try to solve it by letting you pin things, save messages, organize channels - but a stream of conversation is not a stable place to build on top of.

Claude & MCPs are a great starting point to discover data, create quick reports, and get your bearings. But Claude will not kill every UI. Claude is not very good at making small, focused edits when it would be easier to just do it yourself than type out what you want. The cost of describing the change is sometimes higher than making it.

What the Amplitude experience actually taught me is that the interface didn't get less important, but it stopped being the first thing. The agent handled the part I'd been avoiding, and handed me something concrete enough that the UI was finally worth engaging with. But behind all that, someone still had to build what Claude called. The product is still the product.

Designing purely for agents misses that. Behind every agent is still a human with a question, and at some point, that human needs somewhere tangible to land.