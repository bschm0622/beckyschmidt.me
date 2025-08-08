// convex/functions/reactions.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 10;

async function checkRateLimit(ctx : any, clientId: string) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    const recentLogs = await ctx.db
        .query("reactionLogs")
        .withIndex("by_clientId", (q : any) => q.eq("clientId", clientId))
        .collect();

    const recentCount = recentLogs.filter((log : any) => log.timestamp > windowStart).length;

    if (recentCount >= RATE_LIMIT_MAX_REQUESTS) {
        throw new Error("Rate limit exceeded. Please wait before reacting again.");
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
            .withIndex("by_post_reaction", (q) => q.eq("postId", args.postId))
            .collect();

        // Aggregate counts by reaction emoji
        const counts: Record<string, number> = {};
        for (const r of reactions) {
            counts[r.reaction] = (counts[r.reaction] ?? 0) + 1;
        }

        // Return as array like before for UI compatibility
        return Object.entries(counts).map(([reaction, count]) => ({
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
            .withIndex("by_post_reaction_client", (q) =>
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
            timestamp: Date.now(),
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
            .withIndex("by_post_reaction_client", (q) =>
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
        await ctx.db.delete(existing._id);
    },
});
