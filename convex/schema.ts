// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    reactions: defineTable({
        postId: v.string(),
        reaction: v.string(),
        clientId: v.string(),
        timestamp: v.number(),
    })
        .index("by_post_reaction", ["postId", "reaction"]) // for aggregating counts
        .index("by_post_reaction_client", ["postId", "reaction", "clientId"]), // for user-specific queries

        reactionLogs: defineTable({
            clientId: v.string(),
            timestamp: v.number(),
        }).index("by_clientId", ["clientId"]),
});
