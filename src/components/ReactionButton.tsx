import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ReactionButtonProps {
    postId: string;
}

const REACTIONS = ["like"];


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
    const [isClient, setIsClient] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

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
            if (e?.data?.code === "RATE_LIMIT") {
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
                {REACTIONS.map((reaction) => {
                    if (!reactions) {
                        return (
                            <div
                                key={reaction}
                                className="w-16 h-8 rounded bg-gray-300 dark:bg-gray-700 animate-pulse"
                            />
                        );
                    }

                    const reactionData = reactions.find((r) => r.reaction === reaction);
                    const count = reactionData?.count ?? 0;

                    const alreadyReacted = isClient
                        ? !!localStorage.getItem(`reacted_${postId}_${reaction}`)
                        : false;

                    return (
                        <button
                            key={reaction}
                            className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition
                                ${alreadyReacted
                                    ? "bg-primary border-primary text-background dark:text-foreground"
                                    : "border-muted text-tertiary hover:border-foreground/30 hover:text-foreground"
                                }`}
                            onClick={() => handleClick(reaction)}
                            aria-pressed={alreadyReacted}
                        >
                            <span className="text-base leading-none">+</span>
                            <span className="font-medium">{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Error message */}
            {error && (
                <div className="text-red-600 text-sm mt-1" role="alert" aria-live="polite">
                    {error}
                </div>
            )}
        </>
    );
}

export default ReactionButton;
