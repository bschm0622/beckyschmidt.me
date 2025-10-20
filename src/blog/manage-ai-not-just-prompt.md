---
title: "You need to manage AI coding tools, not just prompt them"
slug: "manage-ai-not-just-prompt"
pubDate: "2025-10-20"
author: "Becky Schmidt"
description: "AI coding tools promise you don't need to know anything about code. That's not true. What they actually require is learning to be a manager, not an executor. After shipping six projects, here are 4 things that actually work."
tags: ["AI"]
---
I've been AI-assisted coding for almost a year now. Everyone is sharing the same tips that are generic, recycled, or just not helpful. After shipping six projects to live domains, with countless half-baked experiments living in my GitHub, I've come up with a few tricks that have helped me get much better results from AI coding assistants.

Broadly speaking, AI coding actually requires you to act as a manager. You're not writing the code yourself, but you're in the business. You have to have the vision, you create the direction and strategy, and you ensure everything is going according to plan. You wouldn't expect a great manager to know nothing about the business they're managing, but that's the false dream that these AI coding tools are peddling.

After hundreds of hours fighting with AI, I've figured out how to get repeatable results. Here are 4 things that actually work.

## Table of contents

## 1\. Learn to speak the language (but you don't need to be fluent)

You'll be 10x more successful with AI if you actually know a bit of what you're talking about. I know people hate hearing this because the dream is to write everything in natural language and not have to actually learn. You don't need to take a full course on how to code, or spend hours on research, but you do need to learn as you build.

When AI writes code for you, actually read it. Ask questions about what it's doing if you don't understand. When you pick a framework and ask AI to read documentation and make decisions, ask it to cite why it made those decisions and how it works at a high level.

The difference is huge. Instead of "it's broken, fix it" you can say "move the navigation component to the layout file" or "when I click the submit button it should validate the form before sending." You can paste specific console errors. You can ask for specific fixes. You're the product manager, not the engineer \- but you need enough context to know if the work is good.

## 2\. Create a strategy you actually understand

The common advice is to bring your idea to ChatGPT before going to Lovable or Cursor or Claude Code and create a PRD. I agree \- but only to a point.

If you type "write a PRD for a to-do list app" you'll get one of a billion different variations since AI is non-deterministic. That means you'll get a billion different permutations of a broad plan. Without having a clearer vision yourself, you won't be able to evaluate if the plan is actually good or not.

I prefer to start by conversing with AI to figure out how it would build my idea, talking through specific UX requirements, tech stack, and interactions. Once I feel comfortable with a general plan, then I ask AI to create a PRD. But those three letters alone won't save you from wasting hours on a bad plan if you don't put guardrails on it.

## 3\. Create space for questions: "ask me if you need clarification"

AI produces the average of everything it's trained on. Without clear direction from you, you'll get generic solutions. When you ask it to build something, it needs to understand your specific vision, not just guess based on what's common.

I add this phrase to most prompts to get to more specific outcomes: "ask me if you need clarification or have any questions." Or I'll end with "what do you think?" to prompt feedback.

For example, in one of my projects I wanted a feedback form for users to submit corrections. I described the feature, then asked: "what do you think? think about how to do this in an elegant, non-obtrusive way that mimics behaviors users are used to seeing."

AI came back with questions about placement, whether to show it on all pages, and how to handle submissions. Answering those upfront meant we built exactly what I envisioned instead of something generic I'd have to rework.

## 4\. Set up your project for success with the right infrastructure

Either find a boilerplate, create one, or install the initial dependencies yourself. There's plenty of documentation on how to do this, so there's no reason to let an AI agent create a Next.js \+ Tailwind \+ shad/cn project by itself.

Versions change very quickly. I've had too many instances where AI writes terminal commands that no longer exist, installs older versions, or is just flat-out wrong. Most AI coding experts will tell you to just use older versions because of training cutoffs. I don't like that advice \- it feels like taking a step backward to use new technology. You'll get far better results by reading the latest docs yourself and guiding AI to use modern versions intentionally.

If you start with a solid foundation, working on actual features becomes much easier. Same goes for components. Use a component library and repeatedly remind the agent that it exists. Otherwise you'll end up with AI reinventing buttons and forms instead of using your library.

## The shift from prompting to managing

I just shipped a golf simulator website directory in a week. It went super quickly and smoothly because I approached it differently.

I knew I wanted Astro for static site generation, knew I'd need a scraper for Google data, and knew exactly how the listing pages should work. I set up the boilerplate myself with the right Astro version and component library.

Then I told AI what to build, step by step. When it produced code, I read through it. When something broke, I could paste the specific error and ask for a targeted fix.

I wasn't asking AI to be creative or make architectural decisions. I was using it as an incredibly fast implementation tool for ideas I already had.

## What this means for you

If you're struggling to get consistent results from AI coding tools, the solution isn't better prompts or trying different tools. It's changing how you think about the relationship.

You're not prompting a magic mind-reading code generator. You're managing a very capable but literal team member who needs clear direction, the right infrastructure, and someone who understands the work well enough to know when it's on track.

The dream of knowing nothing about code and still shipping products isn’t quite here yet. But learning to manage AI \- understanding enough to give good direction, ask the right questions, and quality-check the output \- is totally achievable. And it's incredibly powerful.

Here's what that looks like in practice:

- **Learn the language** \- read the code AI writes, ask questions, build context over time  
- **Understand your strategy** \- don't delegate planning to AI, collaborate on it until it makes sense to you  
- **Make space for questions** \- add "ask me if you need clarification" to force better communication  
- **Set up infrastructure** \- provide the foundation so AI can focus on features, not fight with tooling