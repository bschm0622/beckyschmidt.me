---
title: "Building a golf simulator directory in a week"
slug: "building-golf-simulator-directory"
pubDate: "2025-10-18"
author: "Becky Schmidt"
description: "I built golfsimfind.com in a week using AI tools and an SEO strategy. I outline the technical build, the keyword research process, and why competition in a niche is actually a good sign."
tags: ["building in public","web development","golfsimfind"]
---
I launched [golfsimfind.com](http://golfsimfind.com/ref=beckyschmidt.me) today \- a directory for finding golf simulators near you. You might be thinking: I didn't know Becky was into indoor golf. The answer is I'm not. This is another one of my schemes to learn AI tools and maybe create a passive income stream.

I got the inspiration from [Frey Chu](https://www.youtube.com/@FreyChu), who is the website directory guru on YouTube. The appeal is pretty simple: limited marketing (going for an SEO play), no customer support, no complicated feature requests. Just build it, optimize it, and let it run. Here's how I built it in a week.

## Table of contents

## **Finding the keyword**

I spent a few days asking Perplexity, ChatGPT, and Claude for keyword ideas. It became obvious very quickly that AI doesn't actually know what keywords have good search volume or low competition, because the searches it was doing was a bit laughable (best directory niches 2025). But what it does know is uptrending topics. So I'd ask for those, then validate the traffic myself using free tools like Ahrefs, Semrush, and Ubersuggest.

I honestly don't remember how I stumbled upon "golf simulators near me," but the numbers looked decent:

* Keyword difficulty: 34-50 (a bit high, but not impossible)  
* Monthly search volume: around 30k

Then I googled it and found a few other golf simulator directories and got a bit nervous that I was too late. But then I remembered something from Frey Chu’s videos: SEO isn't about being the only one. If there are zero competitors, you probably got into your niche too early and there's no real demand. Competition means there's actual search volume and money to be made. The game is about being the best, and honestly that is not very hard if the keyword difficulty isn’t super high. Most directory sites are poorly designed, have terrible UX, or lack any unique content. The point is not to be perfect but to find weaknesses in your competitors and outperform them there.

## **The technical build**

I started with an Astro and Tailwind template I'd already built. Astro is my favorite framework and is perfect for content-based websites. I also created my own Astro versions of shad/cn components so everything looks uniform. AI LOVES shad/cn, so if you want to have a consistent look without fighting with the AI, I’d suggest just using shad/cn or using shad/cn colors and styling.

Next came generating the actual listings

**Step 1: Scraping locations with Google Maps Places API**

I used the Places API to find golf simulators in key metro areas (plus Indianapolis). You can pass in a city and combine it with your search keyword, and it returns all the relevant businesses with addresses, phone numbers, and basic details. I created the Python script with Claude Code and used Google Colab to run it.

**Step 2: Scraping and summarizing homepages**

Once I had the locations, I used Crawl4AI to scrape each business's homepage. Then I sent that content to Gemini 2.5 Flash to summarize the page and extract amenities, features, and services.

I chose Gemini 2.5 Flash because it has a generous free tier (although the credits are very confusing so you need to be really careful using it). For this kind of bulk processing, you don't need the most sophisticated model \- you just need something that can extract structured data consistently.

**Step 3: Creating a unique asset with pricing data**

I was trying to find a way to differentiate my directory from the others I found online. I used Crawl4AI again to scrape booking pages, then extracted pricing information to create an aggregate pricing guide. I ended up with average prices per simulator from 80 locations. That became a blog post: "How much does it cost to play at a golf simulator?"

**Step 4: SEO optimization**

I used Claude Code to make sure I was following best practices: schema markup, good slug structure, optimized location pages, and a dynamic “compare” page. This was a huge learning opportunity since I'd never really focused on SEO at this level before.

## **What about AI taking over search?**

Everyone online is saying that SEO is dead, GEO / AEO etc. is the future, so it seems kind of like a step backwards to be creating an SEO-first asset.

However, what I’ve noticed from using ChatGPT / Claude / Gemini heavily over the past 10 months: the foundation of getting discovered by AI is still having good SEO. These tools search the Google and surface results based on what's already ranking well. If your site has strong SEO \- good content, proper schema markup, backlinks \- AI tools will find you and cite you.

## **What's next**

I published the site and submitted my sitemap this morning. Within five hours, a bunch of pages were already indexed by Google.

This is my first time doing anything with SEO, so I'm watching for any traction at all \- rankings or traffic or anything. My plan is to keep working on it: add more content, reach out to simulator businesses for backlinks, and expand to more locations. Hopefully in the next 6 months to a year I’ll have enough traffic to monetize through ads.

## **The takeaways**

If you want to do this yourself, I’d recommend the following:

* **AI doesn't know keywords, but it knows trends.** Use it to brainstorm uptrending topics, then validate traffic yourself with real SEO tools.

* **Create a unique asset.** Directories are everywhere, so you have to have an edge. Mine is the pricing data, but it’s got to be specific to your niche and longtail keywords.

* **The perfect niche doesn't exist.** After looking at pages and pages of keyword data you can get analysis paralysis. The way to get ahead is to just start building something, and work at it heartily.
