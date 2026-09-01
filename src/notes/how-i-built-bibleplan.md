---
title: "How I built BiblePlan"
pubDate: 2026-08-31
description: "How I built BiblePlan, a flexible Bible reading plan app."
author: "Becky Schmidt"
tags:
  - side project
---

I originally launched BiblePlan in January 2025. It was created partially to scratch an itch - there is no way to create a truly customizable Bible reading plan (choose your own books, timeline, and skip days). I also created it to try out AI coding for the first time.

## Product Overview

BiblePlan is an app for building a Bible reading plan around your actual life: pick any book or grouping of books, set your own timeline, and skip days of the week for sustainability or general life rhythms. From there, the BiblePlan [algorithm](https://www.bibleplan.app/algorithm) assigns reading across the remaining days as evenly as possible.

As far as I can tell, it's one of the only apps that offers this level of flexibility. Plans can interleave books side by side (i.e. Old and New Testament in parallel) or one after the other. After creating a plan, users get a dashboard that links each day's reading out to Bible Gateway, can export their plan as a CSV or PDF, and have two ways to recover if they fall behind: catch up, which slides the remaining days forward, or rebalance, which recomputes the daily readings across the days left.

## Building

BiblePlan was built using a variety of tools, including GitHub Copilot, Cursor, Claude Code, and Codex. It's a Next.js app, using Supabase as the backend database and authentication layer, and shadcn for UI components.

Since this project was created using early 2025 models, it's been pretty amazing to revisit the project as the models have gotten better and better. When I started the project I was fighting GPT 3.5 at every step to get simple tweaks to the algorithm to better balance plans. Fast forward to a few months ago using Opus 4.7 to better split verses at chapter breaks, and the model basically one-shot my desired change, and tested the change itself with browser use.

## User Acquisition and Activation

BiblePlan's only user acquisition channel is SEO. The beauty of SEO is that it's mostly set and forget, and free, which is why this is the only way I'm marketing so far. And as you can see, it's been growing nicely over the past 20 months.

![Chart of BiblePlan's SEO growth over the past 20 months](/notes-images/how-i-built-bibleplan/seo-growth.png)

At the time of writing, BiblePlan has 360 users, and August was the best month yet at 78 signups. About 60% of users who sign up create a plan - helped along, I think, by one-click starter templates and a demo builder that lets people try the whole thing before signing up. But from there usage drops off - only 19% of signups ever track their reading by checking off days, and just five plans have ever been completed. Plans can also be downloaded, but only 11% ever have been.

BiblePlan is only a webapp, which I think is the biggest blocker for consistent usage. If I were starting over I'd have built it as a PWA from day one, but at the time I didn't know that was an option. In the past few months I made the upgrade, so with some extra steps users can now get push notifications, alongside the daily reminder emails the app already sends. Since adding push, 18% of new users in August have turned it on, so I'm hoping that will help with the dropoff from plan creation to consistent reading.

BiblePlan is completely free today, which is why I've relied completely on free channels for growth and free distribution. BiblePlan would certainly benefit from further marketing efforts or a true iPhone / Android app, but for now I'm happy with how it's growing as a side project, and happy that over 300 people have benefitted from my little app.
