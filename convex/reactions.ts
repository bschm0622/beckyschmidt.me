// convex/functions/reactions.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getReactions = query({
    args: { postId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("reactions")
            .withIndex("by_postId_reaction", (q) => q.eq("postId", args.postId))
            .collect();
    },
});

export const addReaction = mutation({
    args: {
        postId: v.string(),
        reaction: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("reactions")
            .withIndex("by_postId_reaction", (q) =>
                q.eq("postId", args.postId).eq("reaction", args.reaction)
            )
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                count: existing.count + 1,
            });
        } else {
            await ctx.db.insert("reactions", {
                postId: args.postId,
                reaction: args.reaction,
                count: 1,
            });
        }
    },
});

// NEW removeReaction mutation
export const removeReaction = mutation({
    args: {
        postId: v.string(),
        reaction: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("reactions")
            .withIndex("by_postId_reaction", (q) =>
                q.eq("postId", args.postId).eq("reaction", args.reaction)
            )
            .first();

        if (!existing) {
            // No reaction to remove, silently return or throw error if you prefer
            return;
        }

        if (existing.count <= 1) {
            // Delete the record if count will drop to 0
            await ctx.db.delete(existing._id);
        } else {
            // Otherwise decrement count by 1
            await ctx.db.patch(existing._id, {
                count: existing.count - 1,
            });
        }
    },
});
