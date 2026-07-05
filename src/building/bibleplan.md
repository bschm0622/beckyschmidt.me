---
title: "BiblePlan"
tagline: "A free Bible reading plan maker, built because my family couldn't find the Bible reading planner we wanted."
order: 2
links:
  - label: "bibleplan.app"
    href: "https://bibleplan.app?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building"
---

My husband had the idea. We wanted a Bible reading plan that was honestly flexible, one that fit around a real life with a toddler in it, and everything we tried was rigid in the same way: miss a few days and the app mostly just makes you feel guilty. I didn't build this because it was a market opportunity. I'm a Christian, and it was something our own family wanted to exist.

So I built it. [BiblePlan](https://bibleplan.app?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building) is a free reading plan maker: choose what you want to read and how long you have, preview the schedule before you commit to it, then track your progress and get a reminder email at whatever hour you pick. Supabase handles the data, and people I've never met are using it.

## The interesting problem was math

"Read the Bible in 90 days" is easy division and a terrible plan, because chapters vary wildly in length and the dense stretches pile up on you. So the generator works in verses, not chapters. It knows the verse count of all 1,189 chapters and distributes days by reading weight, which means a day in Psalm 119 doesn't land like a day in Psalm 117. You can read groups of books concurrently, Psalms alongside the Law for instance, and there's a Gospel harmony plan that stitches Matthew, Mark, Luke, and John into one chronological story. I published [how the algorithm works](https://bibleplan.app/algorithm?utm_source=beckyschmidt.me&utm_medium=site&utm_campaign=building) right on the site, partly because I think it's interesting and partly because if you're trusting an app with a habit like this, you should be able to see how it works.

## Running it like a product

The reminder emails turned into my favorite problem so far. Users pick their preferred hour, which means the job has to run every hour, and Vercel's free tier allows exactly one cron a day. The fix was an external cron service calling an authenticated endpoint hourly, plus real error reporting for the times it fails while I'm asleep. The commit is literally titled "cron solution :)".

The codebase gets the same discipline I'd expect from a team at work: characterization tests around the plan generator before I let anyone (including AI) refactor it, an architecture audit that caught a UTC day-counting bug, and analytics tied to actual user IDs so I'm watching retention, not just traffic.

## Growing it

BiblePlan is where I'm learning SEO with real stakes. Keyword research turned up "bible reading plan maker" at about a thousand searches a month with almost no competition, which is exactly the query this product answers, so the landing pages are built around what people actually search for: 30 days, 90 days, six months, plus a comparison page against the apps we tried first. Usage keeps growing, and watching strangers actually use something we made for ourselves never gets old.
