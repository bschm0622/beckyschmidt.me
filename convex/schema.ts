// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    reactions: defineTable({
        postId: v.string(),
        reaction: v.string(),
        count: v.number(),
    }).index("by_postId_reaction", ["postId", "reaction"]),
});
