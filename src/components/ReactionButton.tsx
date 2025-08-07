import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ReactionButtonProps {
    postId: string;
}

const EMOJIS = ["👍", "💡", "❤️"];

const TOOLTIP_LABELS: Record<string, string> = {
    "👍": "Like",
    "💡": "Insightful",
    "❤️": "Love",
};

function ReactionButton({ postId }: ReactionButtonProps) {
    const reactions = useQuery(api.reactions.getReactions, postId ? { postId } : "skip");
    const addReaction = useMutation(api.reactions.addReaction);
    const removeReaction = useMutation(api.reactions.removeReaction);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleClick = async (reaction: string) => {
        if (!isClient || !postId) return;

        const localKey = `reacted_${postId}_${reaction}`;
        const hasReacted = !!localStorage.getItem(localKey);

        if (hasReacted) {
            await removeReaction({ postId, reaction });
            localStorage.removeItem(localKey);
        } else {
            await addReaction({ postId, reaction });
            localStorage.setItem(localKey, "true");
        }
    };

    if (!postId) return null;

    return (
        <div className="flex gap-3 mb-2">
            {EMOJIS.map((emoji) => {
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
                    ? !!localStorage.getItem(`reacted_${postId}_${emoji}`)
                    : false;

                return (
                    <div key={emoji} className="relative group">
                        <button
                            className={`px-3 py-1 rounded border text-xl transition
                ${alreadyReacted
                                    ? "bg-primary border-accent text-surface dark:text-foreground hover:bg-accent"
                                    : "border-primary text-foreground hover:bg-gray-200 hover:border-accent dark:hover:bg-gray-800"
                                }
              `}
                            onClick={() => handleClick(emoji)}
                            aria-pressed={alreadyReacted}
                        >
                            {emoji} {count}
                        </button>

                        {/* Tooltip */}
                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                            {TOOLTIP_LABELS[emoji]}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default ReactionButton;
