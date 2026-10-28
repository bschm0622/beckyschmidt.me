---
title: "Building a shared agent editor"
pubDate: "2026-10-28"
description: "I built a writing editor where my agent suggests rewrites, cuts and new paragraphs right in the doc, and I flip through its versions next to mine and decide what stays."
author: "Becky Schmidt"
tags: ["side project"]
---

Writing is my favorite way to share what I'm building, and I've been on a bit of a building kick since Opus 5.5 came out. When I first started writing with AI, I took the path of least resistance by letting AI write for me. This was also a pretty disastrous path, and I could feel my writing skills atrophying. Over time, I learned the proper uses for AI in writing - bouncing ideas, outlining, adversarial review, and editing. What was missing was a shared plane where we could both work.

Collaborative writing is hard enough with humans. Comments work up until a thread gets long, but suggested edits fall apart the moment you want to read a sentence or test a variation, because the strikethroughs bury it. AI doesn't fix any of this. It uses the same Google Docs, through the browser, and runs into the same problems.

I was inspired by [Every's Proof](https://github.com/EveryInc/proof-sdk) and Jason Fried's [Write_On demo](https://x.com/jasonfried/status/2105403067793584590). Proof is a shared editing space for agents, where the agent joins the document and can leave comments and make edits like a Google Doc. But it suffers from the same inline editing style. Write_On takes a better twist on the inline editing. You can cycle through variations of the same word, grouping of words, or paragraphs, and dim sections that you want to test removing. So I took everything I liked about Jason's editor and added Proof's agent experience on top of it. Here's a short demo of how it works.

The agent's suggestions land right in the doc: rewrites, a dimmed cut, and a paragraph it drafted.

![The agent connects and its suggestions appear in the doc: dotted underlines on rewritten sentences, a dimmed phrase it suggests cutting, and a new paragraph it drafted](/notes-images/building-a-shared-agent-editor/1-suggestions-arrive.gif)

I flip through the versions in place. The count in the margin shows how many there are, but only where my cursor is.

![Option and the down arrow cycle a sentence through the agent's rewrites and back to the original, with a 1/3 count in the margin](/notes-images/building-a-shared-agent-editor/2-flip-versions.gif)

A suggested cut stays on the page, dimmed, so I can read the sentence with and without it.

![A dimmed phrase flips back into the sentence and out again](/notes-images/building-a-shared-agent-editor/3-dimmed-cut.gif)

When I want to compare, every version sits side by side, and I keep the one I like.

![A panel lists the original sentence and the agent's two rewrites; one is picked and kept](/notes-images/building-a-shared-agent-editor/4-versions-panel.gif)

When I'm done, Accept all keeps the doc exactly as it reads and gives me a clean copy.

![The alternatives list shows 2 changes; clicking Accept all leaves plain text with no underlines](/notes-images/building-a-shared-agent-editor/5-accept-all.gif)

Under the hood, the AI agent gets access to the document via a small MCP server that has a few tools to help it read and edit the document in my browser. The server runs on my computer and connects my agent to the browser. The agent has tools to suggest alternatives, dim, and draft, but can't approve final changes.

Working on the same surface as my agent feels kind of like the writer's version of watching the game tape. I can read what I wrote and see my agent's suggested rewrite in context. If I like what the agent wrote I can accept the change, or I can keep my own version. I can also see what it proposed to remove. Once I'm happy with the changes, I can accept the current version of the document and publish on my personal site.

The best part about using your own tools is that you can keep iterating and improving as you use it. This post was my first full go-around with the agent, and I found a bunch of surfaces to improve. Two decisions came straight out of writing this post. Early on, Claude told me that it had made 2 different suggestions for a sentence, but the dotted underline gave no indication of how many variations I had to review, so I added an indicator `1/n` while on a section with a variation. The second was comments. After using the editor for a few turns I wondered if comments would actually be useful to ask questions, but decided against it to reduce complexity and visual clutter.

The paragraph above is the best example of "watching the tape" that I have. Claude took five passes at it, and I didn't keep any of them as written. Seeing its versions next to mine is how I figured out what I actually wanted to say.

You can try the editor at [editor.beckyschmidt.me](https://editor.beckyschmidt.me/?utm_source=beckyschmidt.me&utm_medium=blog&utm_campaign=shared-agent-editor). To connect your own agent, clone the repo at [github.com/bschm0622/minimal-editor](https://github.com/bschm0622/minimal-editor).
