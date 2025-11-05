import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ReactionButtonProps {
    postId: string;
}

const REACTIONS = ["like", "insightful", "love"];

const TOOLTIP_LABELS: Record<string, string> = {
    like: "Like",
    insightful: "Insightful",
    love: "Love",
};

const REACTION_ICONS: Record<string, JSX.Element> = {
    like: (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
        </svg>
    ),
    insightful: (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
        </svg>
    ),
    love: (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
        </svg>
    ),
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
                        <div key={reaction} className="relative group">
                            <button
                                className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition
                ${alreadyReacted
                                        ? "bg-primary border-accent text-surface dark:text-foreground hover:bg-accent"
                                        : "border-muted text-foreground hover:bg-muted hover:border-primary"
                                    }
              `}
                                onClick={() => handleClick(reaction)}
                                aria-pressed={alreadyReacted}
                            >
                                {REACTION_ICONS[reaction]}
                                <span className="font-medium">{count}</span>
                            </button>

                            {/* Tooltip */}
                            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                                {TOOLTIP_LABELS[reaction]}
                            </span>
                        </div>
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
