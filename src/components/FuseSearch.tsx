import React, { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";

interface SearchItem {
    title: string;
    description: string;
    tags: string[];
    url: string;
    pubDate: string;
    body: string;
}

interface Props {
    autoFocus?: boolean;
    maxHeight?: string;
}

export default function FuseSearch({ autoFocus = false, maxHeight }: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchItem[]>([]);
    const [allItems, setAllItems] = useState<SearchItem[]>([]);
    const [fuse, setFuse] = useState<Fuse<SearchItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/search-index.json")
            .then((r) => r.json())
            .then((data: SearchItem[]) => {
                setAllItems(data);
                setFuse(
                    new Fuse(data, {
                        keys: [
                            { name: "title", weight: 2 },
                            { name: "tags", weight: 1.5 },
                            { name: "description", weight: 1 },
                            { name: "body", weight: 0.5 },
                        ],
                        threshold: 0.35,
                        ignoreLocation: true,
                        includeScore: true,
                    })
                );
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus, loading]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setQuery(q);
        if (!fuse || !q.trim()) {
            setResults([]);
            return;
        }
        setResults(fuse.search(q.trim()).map((r) => r.item));
    };

    const clearQuery = () => {
        setQuery("");
        setResults([]);
        inputRef.current?.focus();
    };

    const showResults = query.trim().length > 0;
    const noResults = showResults && results.length === 0 && !loading;

    return (
        <div className="fuse-search">
            {/* Input */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    placeholder="Type to search..."
                    disabled={loading}
                    className="w-full px-4 py-2.5 pr-10 rounded-lg border border-[var(--color-muted)] bg-[var(--color-surface)] text-[var(--color-foreground)] text-sm font-normal placeholder:text-[var(--color-tertiary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors disabled:opacity-50"
                    aria-label="Search"
                    autoComplete="off"
                />
                {query && (
                    <button
                        onClick={clearQuery}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-tertiary)] hover:text-[var(--color-foreground)] transition-colors"
                        aria-label="Clear search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Results */}
            {showResults && (
                <div
                    className="mt-4 space-y-5 overflow-y-auto"
                    style={maxHeight ? { maxHeight } : undefined}
                >
                    {noResults && (
                        <p className="text-[var(--color-tertiary)] text-sm">
                            No results for &ldquo;{query}&rdquo;
                        </p>
                    )}
                    {results.map((item) => (
                        <a
                            key={item.url}
                            href={item.url}
                            className="block group"
                        >
                            <div className="text-[var(--color-link)] text-lg font-medium leading-snug group-hover:underline">
                                {item.title}
                            </div>
                            {item.description && (
                                <div className="text-[var(--color-foreground)] text-sm leading-relaxed mt-1">
                                    {item.description}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                                <span className="text-[var(--color-tertiary)] text-xs">
                                    {item.pubDate}
                                </span>
                                {item.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="text-xs text-[var(--color-tertiary)]"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
