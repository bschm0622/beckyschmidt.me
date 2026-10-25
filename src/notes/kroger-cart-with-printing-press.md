---
title: "How I built my own Kroger cart with Printing Press"
pubDate: "2026-10-25"
description: "I used printingpress.dev to create an agent-native CLI for the Kroger app, and then built a UI on top of it for my own use."
author: "Becky Schmidt"
tags: ["side project"]
---

A few months ago I saw [this YouTube video](https://www.youtube.com/watch?v=BxEf3RqIHkw) with Matt Van Horn where he demoed his project [Printing Press](https://printingpress.dev/), a code generator that turns any website or API into an agent-native CLI. It's best for sites with no existing CLI or API, effectively climbing over a walled garden.

I decided to try it on one of my most dreaded weekly tasks: groceries. Every Saturday evening I use the Kroger app to place my pickup order. There are many things I could complain about, but the one that made me curious about Printing Press is that you can't bulk-add items. Every week I buy the same staples (milk, eggs, bread, orange juice) and every week I search for and add them one by one. It feels ridiculous, because Kroger has enough information about me to know I buy these week in and week out, but hasn't built anything for repeat orders. Kroger does have an API, but it requires a developer account and a registered application, and I just wanted to use this on my own account without the hassle.

I gave Claude the Printing Press URL and asked it to help me get started. The first step was logging into [kroger.com](https://kroger.com) with Chrome's developer tools recording, doing a bunch of actions (search, add to cart, open order history, etc.) and giving that recording back to Claude.

Printing Press generated the CLI quickly, but it didn't work right away. My first search for milk came back with zero results because it was using the wrong search parameter. Kroger also has bot protection, and it took quite a bit of finagling to get around it. The solution was to import my Kroger cookie from Chrome and share it with the CLI. By midnight I had a "staples" list built from my last 100 trips that I could add to my cart all at once.

The next step was to create a UI on top of the CLI. The CLI was the ending point of Printing Press, so this part was up to me and Claude. Claude's first pass was horrible without any direction. For example, it listed the pickup fee as my most-bought staple. After a few passes I got it to a decent spot and used it that way for months. I didn't use it every week, but I used it most weeks when I had a big order or knew I needed to restock a lot of household staples.

![Initial UI for the Kroger CLI](/notes-images/kroger-cart-with-printing-press/screenshot-2026-10-25-mvo65sn20.jpg)

A few weeks ago I was getting frustrated with the UX, and realized I was doing exactly what caused my initial frustration: just dealing with what I had built rather than improving it. So I sent Claude two prompts:

> the UX on this is really awful. can you please review & make edits? for 1 it's ugly but the select, clear, multi-select makes no sense as an end-user.
> 
> I want a true redesign. just make it look cleaner, more modern, and unified. you could even just use default like shadcn or starwind defaults to make it look better.

And here's the result:

![Improved UI for the Kroger CLI](/notes-images/kroger-cart-with-printing-press/screenshot-2026-10-25-1-mvo66dvn0.jpg)

Claude added some features I didn't even ask for, like showing what's out of stock at my local store, adding prices and pictures, and making it easier to manage my cart. I ordered my groceries last night with the new version, and it was so much easier than both the old version and the Kroger app.

I'm a huge believer in personal software, but only for people who are committed to maintaining and improving it. I've built dozens of tools I never touched again, because I realized there were other tools out there that solved my pain point much better and I didn't need to maintain them. But I came back to this one because Kroger still isn't solving it for me, and it's a pain I feel every week. If Kroger added "bulk add from a list" tomorrow, I'd stop using my homegrown solution. Until then, I don't have to wait on them and I can keep adding features that make my Saturday grocery orders easier.

If you shop at Kroger, the code is [on GitHub](https://github.com/bschm0622/kroger-cart). It includes a setup file, so you can ask Claude to set it up for you.
