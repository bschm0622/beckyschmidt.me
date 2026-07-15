---
title: "AI at home"
slug: "ai-at-home"
pubDate: "2026-07-15"
author: "Becky Schmidt"
description: ""
tags: ["AI","side-project"]
---

I’m running [Google Gemma 4 E4B](https://ollama.com/library/gemma4:e4b) on my Mac Mini at home, and it’s starting to function as my little household assistant. Local AI is fun because 1) you completely own it, and 2) it’s effectively free. It’s also a bit of a challenge because these non-frontier models are not nearly as smart, so part of the fun is just figuring out where the limits are, building deterministic harnesses to keep them on track, and experimenting.

I built myself a to-do assistant that lives in Slack and keeps my tasks in a SQLite database on my Mac Mini. Through natural language, I can ask it to remind me of anything at a prescribed time and date, and it’ll store that reminder and send me a notification. It’s tailored specifically to how I manage my day, which mostly consists of asking it to remind me of a bunch of stuff for the following few days and then needing to reshuffle because I accidentally put four reminders on the same day. It gently nudges me if I forget, suggests that a day might be overloaded, and checks in if I’ve pushed something over and over again to see if I actually intend to do it or if I need to split the task up.

I also built a receipt scanner app. It started out using Gemini 2.5 Flash, but once Gemma was released with vision capabilities, I decided to take the app in-house to see what it could do. It runs as a local webapp where I can bulk-upload receipts (mainly from Costco and Amazon). It reads the contents, breaks them into individual line items, averages the tax across all items, and categorizes them based on my custom system. This data is stored in a local SQLite database, but it also syncs to Google Sheets for easy cloud access.

AI at home is one of my favorite use cases. I’d never be able to find an app that does exactly what I want to these specifications, but now I can build it quickly using Claude Code and run it for free. If you haven’t yet, I’d highly encourage you to dust off some old hardware, download a Gemma model, and take it for a spin.
