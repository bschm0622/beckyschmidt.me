---
title: "Everyone gets the same idea from AI"
pubDate: "2026-10-18"
description: "How I built CEO Paycheck and steered Claude to find the niche."
author: "Becky Schmidt"
tags: ["side project"]
---

Over the past 18 months I've launched about a dozen websites built with Claude Code. Most recently I've been experimenting with programmatic SEO. In this case, programmatic means that you can produce large amounts of content at scale using a template, instead of writing every page individually. By publishing hundreds or thousands of webpages, you can chase what SEOs call the longtail. I love this site, [longtail.com](http://longtail.com), which beautifully explains it:

> The concept was elegantly simple yet profoundly powerful—the internet enables niche products and interests to find their audiences at scale. Better still, these niches are often far less competitive than mainstream markets, creating fertile ground for creative entrepreneurs willing to go deep rather than broad.

Rather than compete with the biggest websites that you will never outrank, you can compete on longer search terms that the big brands don't bother publishing content for. While these longtail keywords don't get as much traffic, if you can get hundreds of thousands of longtail searches, that volume adds up. And if you care enough about a specific niche topic and can do it at scale, there is a business there.

There are many ways to monetize high-traffic websites. One of the easiest is by joining an ad network and placing display ads on your site, which will earn revenue each time someone visits. The requirement from my preferred ad network (Mediavine Journey) is 1,000 sessions per month, so that was the bar.

I started by asking Claude to find me a high-volume, low-difficulty keyword, and it suggested "paid family leave by state calculator".

Then I had Claude check who was already ranking for paid leave calculators. Two of the sites in the top 10 had been registered that same year, and when I clicked through, they had the same AI-generated design I'd seen a hundred times. Claude explained it well: "The rush exists because the barrier is only the idea. Anyone with AI coding and a public dataset can ship a state-by-state calculator in a weekend."

Everyone is asking AI to give them niche ideas, everyone is getting the same ideas, and everyone is building them.

Turns out you can also find all of the sites that ad networks pay. When I had Claude review that list, it showed hundreds of sites following the same playbook. I had Claude filter it down to new sites with low domain authority and found a bunch of copies of the same types of sites: school calendar aggregators, take-home pay calculators, and menu nutrition calculators, just to name a few.

I tried asking Claude to use these sites as a "golden dataset" of what's working and generate new ideas from them, but it just kept spitting back even more niches that were heavily dominated by AI-generated sites covering hundreds or thousands of pages and already ranking on page one of Google.

One of the niches I tried was yarn. After running through dozens of niches with Claude, I finally settled on this one because it had potential to grow ("grandma" hobbies are rising on Google Trends) and already had good search volume (about 100K monthly searches across low-difficulty terms like "crochet hook size chart").

At this point I had spent a few weeks trying to find a niche, so once I found one I was satisfied with, I let Claude go wild. I asked it to spin up subagents to build the whole site, and went to bed. In under two hours it had built 70 pages and 11 tools.

When I checked it the next morning, the site was a complete mess of information I couldn't verify, because I'm not into knitting at all. The site itself was ugly because I hadn't given it any design references to work off of. It felt like a PDF dump rather than a website.

I could have published the site as is and hoped for the best, but I scrapped it. I was no longer confident I was providing value, and to be honest I don't care about knitting at all so it was hard to get excited about the build.

After the yarn site failure, I decided that my workflow with Claude was not working well and needed a reset. I started by going back to first principles: what are we building, and why? I went back to the "golden dataset" of the new sites on ad networks and used it as a guide, rather than a template. The PSEO sites fell into four broad categories: public-data lookups, spec databases, salary and money data, and directories. My requirements were: a keyword family that could reach 100K monthly searches, the ability to win page 1 of Google, a clean dataset as the underlying data, and a topic I could understand and get excited about. Claude also included a list of topics I had already rejected to prevent suggesting them again.

With those guardrails in place, Claude spun out four subagents (one per category) to find a new niche and found the winner: nonprofit CEO pay from IRS 990 filings, which became [CEO Paycheck](https://ceopaycheck.com). The idea wins on a few fronts. The data is freely available in XML, but it's not totally clean and requires some cleanup, which creates a small barrier to entry. A sampling of the terms (Goodwill CEO salary, St. Jude CEO salary, etc.) came up to about 84K monthly searches, with the ability to hit a higher ceiling by including public company CEO salaries later down the line. Most of the searches were dominated by Quora, ZipRecruiter, and Facebook, meaning there was room for a focused competitor to answer the question directly and land on page 1 of Google.

Next came building the site itself. With the data in place and parseable, the next issue to fix was the design. After dealing with the ugly PDF-style yarn site, I asked Claude to add a rule to my `CLAUDE.md` file: always ask me for a few samples of website designs I like, and mock up a single page before designing the whole site. For CEO Paycheck, I wanted a professional and clean look that didn't look obviously AI-generated, but still had a better UX than the older directory sites. I shared a few website designs I liked and Claude built the site in a matter of hours.

I did make a few missteps by trusting Claude too much during the build. I got overconfident in Claude's ability to parse the 990 forms, and one of the pages went live with the wrong figure. Claude caught its own error a day later and corrected it, but by then I had already sent an email with the wrong number in it.

That taught me the difference between one-way and two-way doors. A two-way door is easy to go in and out of. A figure on the site can be corrected and pushed live again in minutes. An email can't be unsent. For the site build I'm fine letting Claude run on its own and check its own work, but anything that's a one-way door gets checked by hand first. After that, I had Claude check every figure on the site against the original 990 filings: 797 values, 0 mismatches.

So far, I'm seeing modest success from the site. As you can see in the screenshot below, impressions and clicks are picking up: 11.7K impressions last week at an average position of 7.7, and about 18 clicks a day. That's roughly 550 visits a month from Google, a little over halfway to Journey's requirement of 1,000. Pages are still being indexed, and I have a plan to add more pages, but it will be a while until I qualify.

![Screenshot of Google Search Console results](/notes-images/everyone-same-idea-ai/screenshot-2026-10-18-mvemplx30.jpg)

If I started another site tomorrow, I wouldn't ask Claude for a niche. I'd give it examples of sites that are already winning, the list of every idea I've ruled out, and the bar an idea has to clear: a keyword family that can reach 100K searches, data that takes some work to clean, and a winnable page 1 I've checked by hand.
