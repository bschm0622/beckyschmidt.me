// src/components/ReactionApp.tsx
import React from "react";
import { CONVEX_URL } from "astro:env/client";
import type { FC } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import ReactionButton from "./ReactionButton";

const client = new ConvexReactClient(CONVEX_URL);

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
