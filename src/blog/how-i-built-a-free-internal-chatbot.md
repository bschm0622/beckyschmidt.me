---
title: How I built a free internal chatbot
slug: how-i-built-a-free-internal-chatbot
pubDate: 2025-09-30
author: Becky Schmidt
description: I built an internal chatbot based on a tweet. Here's how it works and why you should just start building when you see cool ideas that aren't fully explained.
tags: ["AI","building in public"]
---
Yesterday I saw this tweet that caught my attention:

<img src="/ChatbotTweet.png" alt="Tweet by tyler_agg" width="250" style="height:auto;" />

[Link to X](https://x.com/tyler_agg/status/1961491485591048218?s=12) 

The thread outlined a simple idea: create an internal chatbot that can search through your company's documents and SOPs. But, in typical X fashion, the comments were full of people saying things like, "this sounds great, but how do you actually build it?" and "you missed about 7 steps here."

Instead of waiting around for someone else to fill in the gaps, I decided to just build it myself.

You can find the complete code and setup instructions at my GitHub repository. The README will walk you through getting everything configured.

[**GitHub Repository**](https://github.com/bschm0622/google-drive-chatbot)

I'll walk you through what I built and how it works, but the bigger takeaway is simple: when you see an incomplete idea, just start building.

## How it works

The chatbot does exactly what that tweet promised: searches your Google Drive documents and gives real answers with citations. Ask "how do we handle refunds?" and it finds the relevant sections, gives you a clear answer, and shows you exactly which documents it pulled from.

You can search across everything or pick a specific document. New files get indexed automatically. And since it's built with Google Apps Script, there's no infrastructure to manage and it deploys in one click.

## Technical overview

From a technical standpoint, the AI engine powering the chatbot is simple but powerful:

* The system scans a Google Drive folder for documents.  
* Each document is split into small, manageable chunks (about a paragraph each) to improve search accuracy and speed.  
* Each chunk is turned into a “meaning-based” vector embedding that captures concepts, not just keywords.  
* All chunks and metadata are stored in a simple Google Sheet instead of a separate database.  
* When a question is asked, the system finds the most relevant chunks, sends them to Gemini, and generates an answer with citations linking back to the source documents.  
* The index refreshes daily or on demand to reflect new, updated, or deleted files.

None of this was obvious to me when I started \- I had no idea how I was going to create a chatbot using just Google Drive. But that's exactly the point...

## Just start building

Curiosity is your biggest advantage in the AI era.

When you see someone share a cool concept online without the exact implementation, that's your opportunity to start building. Instead of waiting around in the comments for someone else to explain the missing steps, start asking questions. I used ChatGPT to get started, then when it got too complex, I put the files in a folder and asked Claude Code to review and finish out the project.

In a world where everyone has access to AI, the biggest differentiator is who actually builds stuff instead of just talking about it.