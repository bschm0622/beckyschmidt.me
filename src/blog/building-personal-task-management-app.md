---
title: Building my personal task management app
slug: building-personal-task-management-app
pubDate: 2025-09-02
author: Becky Schmidt
description: Anyone can build software with AI now, but you still need good UX principles. Here's how I designed a task management app that actually matches how I work, plus 4 principles you can steal for your own projects hee
tags: ["product management","AI"]
---
I built my own task management app in a weekend with Claude Code. I wrote about why I think [personalized software is the future of software development](https://beckyschmidt.me/blog/economics-of-personalized-software/), and my goal with this post is to share how I think about creating software with over 4 years of product management experience.

Today, anyone can build software with AI, but you still need a basic understanding of software best-practices to create truly useful applications. I'll share UX (user experience) principles that I used while building, and examples from my project.

## Table of contents

## **Start with a plan**

Before coding anything, I started by chatting back and forth with ChatGPT about my problem. Here is the exact prompt I shared with ChatGPT:  
``` 
I want to create a little home management app for myself. I find that I get overwhelmed by all the tasks I have to do and it just lives in my head and every day I'm trying to make decisions of what to do and then I just don't do anything.

I had an idea to manage it kinda kanban style where each day is a swim lane and I can drop tasks into each swim lane from my "backlog". Examples of the tasks include cooking specific meals/food, cleaning specific things or rooms, buying stuff, planning things… General household management.

What do you think of my swimlanes idea, does this seem good or bad? Let's evaluate my problem and proposed solution before trying to build anything.    
``` 
I already started with an idea of how I wanted the software to work (kanban-style swimlanes, due to my background in product management) but I would strongly advise starting by brainstorming with ChatGPT before jumping into any sort of AI coding tool. This will help you clarify your idea and work through any technical considerations you weren’t aware of. After some back and forth, we got to this prompt that I shared with my AI coding tool:  

```
**Project Idea: Personal Home Management Planner**

I want to build a **mobile-first, planning-focused web app** to help me manage household tasks without feeling overwhelmed. I often keep all tasks in my head—cooking, cleaning, shopping, planning—and end up procrastinating because of decision fatigue.

The app will let me:

* **Capture tasks in a backlog** so nothing is forgotten.

* **Plan my week visually**, using collapsible daily lanes (Mon–Sun) where I can assign tasks for the week.

* **Handle recurring/weekly template tasks** that I can either schedule or defer.

* **Mark tasks as done**, move unfinished tasks back to the backlog, and review weekly or monthly history.

The MVP will focus on **reducing mental load and making weekly planning simple**, with a workflow that’s flexible, visual, and entirely web-based.
```

## Choose your fighter (AI assistant)

I won't go into too much detail here because there are hundreds, if not thousands of YouTube videos, blogs, etc. that you can read on this, but if you are wanting to get started with AI-assisted coding, here are my top choices:

* [Lovable](https://lovable.dev/) if you have no coding experience  
* [Replit](https://replit.com/) if you have a complex idea and little or no coding experience  
* [Cursor](https://cursor.com/) if you have some coding experience  
* [Claude Code](https://www.anthropic.com/claude-code) if you have a lot of coding experience

I've tried all four of these and I built this last app with Claude Code. But all four are good choices to get started\!

## **UX Principle \#1: Use constraints strategically**

One of the most differentiated features of my app is limiting the view to just "this week" and "next week" instead of an endless calendar.

I did this to avoid the pitfall I had with other task apps: decision fatigue. When I can schedule tasks infinitely into the future, I spend a lot of mental energy on "when should I do this?" instead of "should I do this at all?" The two-week constraint forces me to think about what's actually actionable right now.

Most productivity tools give you infinite flexibility because it feels more powerful. But sometimes the best UX decision is to remove options. For tasks that need to be done months out, I would rather put them on my calendar, rather than see them in my day-to-day task management app.

<video autoplay loop playsinline controls width="250">
  <source src="/WeekView.MP4" type="video/mp4">
  Your browser does not support the video tag.
</video>

## **UX Principle \#2: Keep systems clean**

I built two features that prevent the app from becoming a dumping ground: automatic weekly resets and forced maintenance.

**Automatic reset:** Every week, unfinished tasks automatically move from "this week" back to the backlog. The calendar shifts forward and I start fresh. Clean slates improve focus \- when my active workspace resets weekly, I'm always looking at current priorities instead of stale commitments from weeks ago.

**Forced maintenance:** Every Sunday when the week resets, the app surfaces the 5 oldest backlog items and requires you to make a decision: schedule them, delete them, or put them back in the backlog. If something sits in the backlog for weeks without getting pulled forward, it's worth questioning whether it needs to be done at all.

**Systems that only accumulate eventually become unusable.** The combination of automatic cleanup and forced review keeps the app functional instead of overwhelming.

<video autoplay loop playsinline controls width="250">
  <source src="/BacklogReview.MP4" type="video/mp4">
  Your browser does not support the video tag.
</video>

## **UX Principle \#3: Automate tedium, preserve judgment**

Most apps handle recurring tasks by just duplicating them automatically on schedule. I built recurring task templates that you bulk-create from each week.

The difference is that I get to choose which recurring tasks to tackle each week instead of the app deciding for me. My capacity and priorities change week to week. Sometimes I have bandwidth for deep cleaning, sometimes I don't. The app gives me the templates but leaves the decision-making to me.

<video autoplay loop playsinline controls width="250">
  <source src="/RecurringTasks.MP4" type="video/mp4">
  Your browser does not support the video tag.
</video>

## **UX Principle \#4: Make important concepts visually obvious**

I made two design choices that provide immediate visual feedback:

**Kanban layout:** I went with a kanban layout (Backlog → This Week → Next Week) instead of a simple list. Each column shows as a collapsible row with a count of how many tasks are inside. When I see "This Week (8)" I naturally question whether I should add more. A simple list doesn't give that immediate capacity feedback.

**Opens to today:** The app opens directly to today's tasks with all other days collapsed. When I open a task management app, I'm thinking "what do I need to do now?" not "let me review my entire week." Progressive disclosure keeps the interface clean while still making everything accessible when I need it.

<img src="/KanbanView.png" alt="Kanban View" width="250" style="height:auto;" />


## **The transferable takeaways**

Whether you're building a todo app, a fitness tracker, or anything else:

1. **Start with what frustrates you about existing solutions** \- that's where the innovation opportunities are  
2. **Use constraints strategically** \- sometimes removing options makes the experience better  
3. **Keep systems clean** \- don't let your app become a dumping ground without regular cleanup  
4. **Automate tedium, preserve judgment** \- by making recurring decisions easier, you can reduce friction but also make it easy for the user to decide  
5. **Make important concepts visually obvious** \- if it matters to the workflow, it should be visible in the interface

Building tools for yourself is incredibly satisfying because you get to optimize for effectiveness instead of marketability. When I want to change how something works, I can just change it. That control over your own workflow is worth way more than any subscription cost savings. More importantly, I actually use this app every day because it matches exactly how I think about getting things done, instead of forcing me to adapt to someone else's productivity philosophy.