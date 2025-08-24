---
title: "Testing Convex with Astro: building reactions into my blog"
slug: testing-convex-astro-reactions
pubDate: 2025-08-09
author: Becky Schmidt
description: I tried out Convex to add realtime reactions to my Astro blog, and
  it was surprisingly smooth and fun. In this post, I walk through how I built
  it and got it running on Netlify.
tags: astro,convex
---
## Table of contents

## Introduction

Lately, I’ve become a big fan of [Astro](https://astro.build/) and have been eager to deepen my knowledge. I kept seeing people talk about [Convex](https://www.convex.dev/), so I decided to give it a try on my personal site. If you want to follow along, all the code is publicly available on [GitHub](https://github.com/bschm0622/beckyschmidt.me) - feel free to check it out!

I wanted to start with a small, achievable feature, so I asked ChatGPT for ideas and it suggested adding realtime reactions to my blog posts. Below, I’ll walk you through the process I followed to build this feature. Overall, the development went smoothly, and I’m very happy with the results! As usual, mixing a primarily static site framework with realtime interactivity had its quirks, but that’s all part of the journey 🙂

## Designing the feature

I created two tables for storing reactions:

*   `reactions` stores the actual reaction data from users:
    
    *   `clientId`: a randomly generated ID saved in the user’s localStorage
        
    *   `postId`: the unique slug for the blog post
        
    *   `reaction`: the emoji reaction
        
    *   `timestamp`: when the reaction was made
        
*   `reactionLogs` tracks each time a user clicks a reaction button, for rate limiting:
    
    *   `clientId`: the user’s randomly generated ID
        
    *   `timestamp`: when the reaction click happened
        

To keep things simple, I store reactions in the user’s browser localStorage, so users can only use each reaction once per post, all without requiring login.

Here’s how it works:

*   When a user clicks a reaction button, we check localStorage to see if they’ve already reacted to that post with that emoji.
    
*   If not, we generate a unique clientId, send a request to Convex to add the reaction to the database, and save a record in localStorage to remember their choice. We also log the click in reactionLogs for rate limiting.
    
*   If they already reacted, clicking again removes the reaction record from reactions and clears the localStorage reaction. This removal is also logged in reactionLogs.
    
*   The reactionLogs table enables a simple rate limiting mechanism to prevent users from spamming reaction buttons, all without requiring login.
    

## Getting into the code

If you want to implement this feature in your Astro project, you’ll need to start by installing a couple of packages:

*   [React integration](https://docs.astro.build/en/guides/integrations-guide/react/) for Astro
    
*   [Convex](https://www.convex.dev/templates/astro)
    
Once those are installed, create a schema file at `convex/schema.ts` to define your tables.
    

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    reactions: defineTable({
        postId: v.string(),
        reaction: v.string(),
        clientId: v.string(),
        timestamp: v.number(),
    })
        .index("by\_post\_reaction", \["postId", "reaction"\]) // for aggregating counts
        .index("by\_post\_reaction\_client", \["postId", "reaction", "clientId"\]), // for user-specific queries

        reactionLogs: defineTable({
            clientId: v.string(),
            timestamp: v.number(),
        }).index("by\_clientId", \["clientId"\]),
});
```

Next, implement your backend functions at `convex/reactions.ts`. These include three main functions - getting, adding, and removing reactions - along with a rate limiting mechanism.

```ts
import { query, mutation } from "./\_generated/server";
import { ConvexError, v } from "convex/values";

const RATE\_LIMIT\_WINDOW\_MS = 60 \* 1000; // 1 minute window
const RATE\_LIMIT\_MAX\_REQUESTS = 10;
  
async function checkRateLimit(ctx : any, clientId: string) {
    const now = [Date.now](http://Date.now)();
    const windowStart = now - RATE\_LIMIT\_WINDOW\_MS;

    const recentLogs = await ctx.db
        .query("reactionLogs")
        .withIndex("by\_clientId", (q : any) => q.eq("clientId", clientId))
        .collect();

    const recentCount = recentLogs.filter((log : any) => log.timestamp > windowStart).length;
        if (recentCount >= RATE\_LIMIT\_MAX\_REQUESTS) {
        throw new ConvexError({
            code: "RATE\_LIMIT",
            message: "Rate limit exceeded. Please wait before reacting again."
        });
        }
  
    // Log this reaction action for rate limiting
    await ctx.db.insert("reactionLogs", { clientId, timestamp: now });
}

export const getReactions = query({
    args: { postId: v.string() },
    handler: async (ctx, args) => {
        // Get all reaction records for the post
        const reactions = await ctx.db
            .query("reactions")
            .withIndex("by\_post\_reaction", (q) => q.eq("postId", args.postId))
            .collect();

        // Aggregate counts by reaction emoji
        const counts: Record<string, number> = {};
        for (const r of reactions) {
            counts\[r.reaction\] = (counts\[r.reaction\] ?? 0) + 1;
        }

        // Return as array like before for UI compatibility
        return Object.entries(counts).map((\[reaction, count\]) => ({
            reaction,
            count,
        }));
    },
});

export const addReaction = mutation({
    args: {
        postId: v.string(),
        reaction: v.string(),
        clientId: v.string(), // new arg for per-user tracking
    },
    handler: async (ctx, args) => {
        // Check rate limit before proceeding
        await checkRateLimit(ctx, args.clientId);

        // Check if this user already reacted with this emoji on this post
        const existing = await ctx.db
            .query("reactions")
            .withIndex("by\_post\_reaction\_client", (q) =>
                q
                    .eq("postId", args.postId)
                    .eq("reaction", args.reaction)
                    .eq("clientId", args.clientId)
            )
            .first();

        if (existing) {
            // User already reacted, no duplicate reactions allowed
            return;
        }

        // Insert new reaction record for this user
        await ctx.db.insert("reactions", {
            postId: args.postId,
            reaction: args.reaction,
            clientId: args.clientId,
            timestamp: [Date.now](http://Date.now)(),
        });
    },
});

export const removeReaction = mutation({
    args: {
        postId: v.string(),
        reaction: v.string(),
        clientId: v.string(),
    },

    handler: async (ctx, args) => {
        // Check rate limit before proceeding
        await checkRateLimit(ctx, args.clientId);

        // Find the user-specific reaction record
        const existing = await ctx.db
            .query("reactions")
            .withIndex("by\_post\_reaction\_client", (q) =>
                q
                    .eq("postId", args.postId)
                    .eq("reaction", args.reaction)
                    .eq("clientId", args.clientId)
            )
            .first();

        if (!existing) {
            // No reaction found to remove
            return;
        }

        // Delete this user’s reaction record
        await ctx.db.delete(existing.\_id);
    },
});
```

After that, create a reaction button component. This component uses localStorage to track whether a user has reacted to a post, so it can show the button state accordingly:

*   If the user hasn’t reacted to a post with an emoji, the button shows as unselected and clicking it will:
    
    *   create a clientId if needed
        
    *   add the reaction in Convex
        
    *   save a record in localStorage
        
*   If the user has already reacted, the button shows as selected, and clicking it again removes the reaction both from Convex and localStorage
    
*   There’s an edge case where a user’s localStorage shows a reaction but the Convex count is zero; in that case, the button still appears selected with a count of zero. To keep things simple, I decided not to cross-check localStorage against Convex counts.
    

The button also includes a rate limiting error message if a user clicks too many times too quickly, and tooltips explain what each emoji means on hover.

```tsx
import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/\_generated/api";

interface ReactionButtonProps {
    postId: string;
}

const EMOJIS = \["👍", "💡", "❤️"\];

const TOOLTIP\_LABELS: Record<string, string> = {
    "👍": "Like",
    "💡": "Insightful",
    "❤️": "Love",
};

function getOrCreateClientId() {
    let clientId = localStorage.getItem("anonClientId");
    if (!clientId) {
        clientId = crypto.randomUUID();
        localStorage.setItem("anonClientId", clientId);
    }
    return clientId;
}

function ReactionButton({ postId }: ReactionButtonProps) {
    const reactions = useQuery(api.reactions.getReactions, postId ? { postId } : "skip");
    const addReaction = useMutation(api.reactions.addReaction);
    const removeReaction = useMutation(api.reactions.removeReaction);
    const \[isClient, setIsClient\] = useState(false);
    const \[error, setError\] = useState<string | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, \[\]);

    const handleClick = async (reaction: string) => {
        if (!isClient || !postId) return;

        setError(null); // reset error on new action
        const clientId = getOrCreateClientId();
        const localKey = `reacted_${postId}_${reaction}`;
        const hasReacted = !!localStorage.getItem(localKey);

        try {
            if (hasReacted) {
                await removeReaction({ postId, reaction, clientId });
                localStorage.removeItem(localKey);
            } else {
                await addReaction({ postId, reaction, clientId });
                localStorage.setItem(localKey, "true");
            }
        } catch (e: any) {
            console.error("Reaction error:", e);
            if (e?.data?.code === "RATE\_LIMIT") {
                setError("You've reacted way too many times in a row. Take a break and just pick one reaction in a few!");
            } else {
                setError("Something went wrong. Please try again.");
            }
        }
    };
  
    if (!postId) return null;

    return (
        <>
            <div className="flex gap-3 mb-2">
                {[EMOJIS.map](http://EMOJIS.map)((emoji) => {
                    if (!reactions) {
                        return (
                            <div
                                key={emoji}
                                className="w-20 h-9 rounded-full bg-gray-300 dark:bg-gray-700 animate-pulse"
                            />
                        );
                    }

                    const reactionData = reactions.find((r) => r.reaction === emoji);
                    const count = reactionData?.count ?? 0;
                    const alreadyReacted = isClient
                        ? !!localStorage.getItem(\`reacted\_${postId}\_${emoji}\`)
                        : false;

                    return (
                        <div key={emoji} className="relative group">
                            <button
                                className={\`px-3 py-1 rounded border text-xl transition
                ${alreadyReacted
                                        ? "bg-primary border-accent text-surface dark:text-foreground hover:bg-accent"
                                        : "border-primary text-foreground hover:bg-gray-200 hover:border-accent dark:hover:bg-gray-800"
                                    }
              \`}
                                onClick={() => handleClick(emoji)}
                                aria-pressed={alreadyReacted}
                            >
                                {emoji} {count}
                            </button>

                            {/\* Tooltip \*/}
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                                {TOOLTIP\_LABELS\[emoji\]}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/\* Error message \*/}
            {error && (
                <div className="text-red-600 text-sm mt-1" role="alert" aria-live="polite">
                    {error}
                </div>
            )}
        </>
    );
}

export default ReactionButton;
```

Next, I created a Convex wrapper component for the reaction button. This wrapper provides the necessary Convex context and passes down the postId prop.

I initially thought I could make a generic wrapper that would work for any Astro component based on the [Convex / Astro starter](https://github.com/get-convex/templates/tree/main/template-astro). However, after some trial and error (mostly asking ChatGPT) I learned that Convex’s React hooks (`useQuery` and `useMutation`) need both:

*   the backend connection, provided by the `ConvexProvider`
    
*   the specific data to query, identified here by the `postId`
    

Astro’s architecture adds some rigidity because each React island on the page initializes separately with only the props explicitly passed from Astro. This means you can’t rely on a single, global provider to manage context and dynamic props across multiple embedded React components.

As a result:

*   If your component needs both Convex context and dynamic props like `postId`, you have to create a wrapper that explicitly sets up Convex and receives those props.
    
*   In this project, the ReactionButton is tightly coupled to blog posts, so I made a wrapper component, ReactionApp, that takes `postId` and sets up Convex accordingly.
    
*   If you want to use Convex elsewhere without `postId`, you’d need a different wrapper tailored to that use case.
    

```tsx
import React from "react";
import { CONVEX\_URL } from "astro:env/client";
import type { FC } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import ReactionButton from "./ReactionButton";

const client = new ConvexReactClient(CONVEX\_URL);
interface ReactionAppProps {
    postId: string;
}

const ReactionApp: FC<ReactionAppProps> = ({ postId }) => {
    return (
        <ConvexProvider client={client}>
            <ReactionButton postId={postId} />
        </ConvexProvider>
    );
};

export default ReactionApp;
```

## Deploying to Netlify

Deploying to Netlify was a bit tricky, but here’s what worked for me:

*   Add your [CONVEX\_URL and CONVEX\_DEPLOY\_KEY](https://docs.convex.dev/dashboard/deployments/deployment-settings) as environment variables in Netlify.
    
*   Use this build command to deploy Convex only in production:
    

```ts
if \[ "$CONTEXT" = "production" \]; then npx convex deploy --cmd 'npm run build'; else npm run build; fi
```

Convex’s free tier does not support preview deployments. Following the official [Convex / Netlify deployment docs](https://docs.convex.dev/production/hosting/netlify) alone didn’t account for this, so my preview branches couldn’t build because Convex refuses to use production keys in non-production environments (like branch previews). To work around this, I excluded Convex deployment from non-production builds and only deploy it on production. I strongly recommend checking out the [Convex discord](https://discord.com/invite/nk6C2qTeCq) if you get stuck, that's how I found this solution for Netlify.

This limitation is a bit frustrating because you can’t test Convex in Netlify preview deployments, you have to rely on local testing and then push to production. There may be ways around this, but for a small feature like this, I was fine with moving on once production deployment worked.

## Final takeaways

Overall, I really like Convex. I’ve been hesitant to add React to my Astro projects (I actually rebuilt this entire site a few months ago to remove all the React dependencies) but shipping this small realtime feature made it worth trying out Convex and React together.

I was impressed by how quickly I could set up Convex via their CLI. It literally took me about 10 minutes to sign up and see my schema and functions appear in the Convex dashboard.

On the side, I’m building [indycreator.com](http://indycreator.com), which uses Supabase. Since I don’t need realtime functionality there, I don’t think Convex is the right fit for that project. I also prefer SQL for most use cases, but if you’re debating Supabase vs. Convex, I recommend reading [this comparison](https://www.convex.dev/compare/supabase) on Convex’s blog.

This was a fun first test-drive of Convex, and I’m always looking to try new tools and expand my Astro knowledge. If you have any suggestions for what I should explore next, let me know!