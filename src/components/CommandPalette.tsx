import React, { useState, useEffect, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import { navigate } from "astro:transitions/client";
import { SITE } from "@/siteConfig";
// Client component: import formatDate from the client-safe module
// (@/lib/notes pulls in the server-only astro:content), and the projects
// JSON directly (content collections aren't available client-side).
import { formatDate } from "@/lib/slugify";
import projects from "@/data/projects.json";

interface SearchItem {
    kind: "note" | "page";
    title: string;
    description: string;
    tags: string[];
    url: string;
    pubDate: string;
    body: string;
}

interface Command {
    id: string;
    label: string;
    sublabel?: React.ReactNode;
    /** Sublabel is a search excerpt: allow two lines instead of one. */
    excerpt?: boolean;
    hint?: string;
    external?: boolean;
    icon?: React.ReactNode;
    group: string;
    perform: () => void;
}

interface Props {
    maxHeight?: string;
}

// --- Actions (all reuse existing site machinery) ---
const closePalette = () => window.closeSearchModal?.();
const goInternal = (url: string) => {
    closePalette();
    navigate(url);
};
const goExternal = (url: string) => {
    closePalette();
    window.open(url, "_blank", "noopener,noreferrer");
};
const mailTo = (email: string) => {
    closePalette();
    window.location.href = `mailto:${email}`;
};
// Copies only; the "Copied" confirmation + delayed close is handled in runItem.
const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
};

// Icons — hugeicons (stroke-rounded) on the left of Actions rows, plus the
// external-link box (same glyph as prose links) trailing outbound items.
// Nav and note rows stay text-only.
const iconCls = "size-4 shrink-0";
const IconMail = () => (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 6L8.91302 9.91697C11.4616 11.361 12.5384 11.361 15.087 9.91697L22 6" />
        <path d="M2.01577 13.4756C2.08114 16.5412 2.11383 18.0739 3.24496 19.2094C4.37608 20.3448 5.95033 20.3843 9.09883 20.4634C11.0393 20.5122 12.9607 20.5122 14.9012 20.4634C18.0497 20.3843 19.6239 20.3448 20.7551 19.2094C21.8862 18.0739 21.9189 16.5412 21.9842 13.4756C22.0053 12.4899 22.0053 11.5101 21.9842 10.5244C21.9189 7.45886 21.8862 5.92609 20.7551 4.79066C19.6239 3.65523 18.0497 3.61568 14.9012 3.53657C12.9607 3.48781 11.0393 3.48781 9.09882 3.53656C5.95033 3.61566 4.37608 3.65521 3.24495 4.79065C2.11382 5.92608 2.08114 7.45885 2.01576 10.5244C1.99474 11.5101 1.99475 12.4899 2.01577 13.4756Z" />
    </svg>
);
const IconLinkedIn = () => (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 10V17" />
        <path d="M11 13V17M11 13C11 11.3431 12.3431 10 14 10C15.6569 10 17 11.3431 17 13V17M11 13V10" />
        <path d="M7.125 6.75H7M7.25 6.75C7.25 6.88807 7.13807 7 7 7C6.86193 7 6.75 6.88807 6.75 6.75C6.75 6.61193 6.86193 6.5 7 6.5C7.13807 6.5 7.25 6.61193 7.25 6.75Z" />
        <path d="M3 12C3 7.75736 3 5.63604 4.31802 4.31802C5.63604 3 7.75736 3 12 3C16.2426 3 18.364 3 19.682 4.31802C21 5.63604 21 7.75736 21 12C21 16.2426 21 18.364 19.682 19.682C18.364 21 16.2426 21 12 21C7.75736 21 5.63604 21 4.31802 19.682C3 18.364 3 16.2426 3 12Z" />
    </svg>
);
const IconCopy = () => (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 15C9 12.1716 9 10.7574 9.87868 9.87868C10.7574 9 12.1716 9 15 9L16 9C18.8284 9 20.2426 9 21.1213 9.87868C22 10.7574 22 12.1716 22 15V16C22 18.8284 22 20.2426 21.1213 21.1213C20.2426 22 18.8284 22 16 22H15C12.1716 22 10.7574 22 9.87868 21.1213C9 20.2426 9 18.8284 9 16L9 15Z" />
        <path d="M16.9999 9C16.9975 6.04291 16.9528 4.51121 16.092 3.46243C15.9258 3.25989 15.7401 3.07418 15.5376 2.90796C14.4312 2 12.7875 2 9.5 2C6.21252 2 4.56878 2 3.46243 2.90796C3.25989 3.07417 3.07418 3.25989 2.90796 3.46243C2 4.56878 2 6.21252 2 9.5C2 12.7875 2 14.4312 2.90796 15.5376C3.07417 15.7401 3.25989 15.9258 3.46243 16.092C4.51121 16.9528 6.04291 16.9975 9 16.9999" />
    </svg>
);
const IconCheck = () => (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
    </svg>
);
// External-link box — same glyph as prose links; trails outbound items.
// Fades from muted → muted-foreground when its row is active, mirroring the
// Projects list on the homepage.
const IconExternalLink = ({ active }: { active?: boolean }) => (
    <svg
        className={`size-3.5 shrink-0 transition-colors ${active ? "text-muted-foreground" : "text-muted"}`}
        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"
    >
        <path fill="currentColor" d="M10 6v2H5v11h11v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm11-3v8h-2V6.413l-7.793 7.794l-1.414-1.414L17.585 5H13V3z" />
    </svg>
);

// --- Search excerpts ---
// Where a note or page matched, so a result shows the term in context instead
// of only its description. Tries the whole query first, then its longest word.
const EXCERPT_BEFORE = 40;
const EXCERPT_AFTER = 140;

// Matches only at the start of a word, so "fi" finds "files" but not "profile".
function findTerm(text: string, q: string): { at: number; len: number } | null {
    const lower = q.toLowerCase();
    const terms = [lower, ...lower.split(/\s+/).filter((w) => w.length >= 3).sort((a, b) => b.length - a.length)];
    for (const t of terms) {
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const m = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "iu").exec(text);
        if (m) return { at: m.index, len: t.length };
    }
    return null;
}

function Highlight({ text, at, len }: { text: string; at: number; len: number }) {
    return (
        <>
            {text.slice(0, at)}
            <mark className="bg-transparent text-foreground font-medium">{text.slice(at, at + len)}</mark>
            {text.slice(at + len)}
        </>
    );
}

/** Sublabel for a note/page result: description (highlighted if it holds the
 *  term), else the body passage around the term, else the plain description. */
function resultSublabel(item: SearchItem, q: string): { node?: React.ReactNode; excerpt: boolean } {
    const inDesc = item.description ? findTerm(item.description, q) : null;
    if (inDesc) return { node: <Highlight text={item.description} {...inDesc} />, excerpt: false };
    const inTitle = findTerm(item.title, q);
    const inBody = inTitle ? null : findTerm(item.body, q);
    if (!inBody) return { node: item.description || undefined, excerpt: false };

    let start = Math.max(0, inBody.at - EXCERPT_BEFORE);
    let end = Math.min(item.body.length, inBody.at + inBody.len + EXCERPT_AFTER);
    // Snap to word boundaries so the excerpt doesn't open or close mid-word.
    if (start > 0) start = item.body.indexOf(" ", start) + 1 || start;
    if (start > inBody.at) start = inBody.at;
    if (end < item.body.length) end = Math.max(inBody.at + inBody.len, item.body.lastIndexOf(" ", end));
    const text = `${start > 0 ? "…" : ""}${item.body.slice(start, end)}${end < item.body.length ? "…" : ""}`;
    const at = inBody.at - start + (start > 0 ? 1 : 0);
    return { node: <Highlight text={text} at={at} len={inBody.len} />, excerpt: true };
}

// Static commands — navigation, projects, and actions. Built once.
const STATIC_COMMANDS: Command[] = [
    ...SITE.nav.map((link) => ({
        id: `nav:${link.href}`,
        label: link.label,
        group: "Go to",
        perform: () => goInternal(link.href),
    })),
    ...projects.map((p) => ({
        id: `project:${p.href}`,
        label: p.name,
        sublabel: p.description,
        external: true,
        group: "Projects",
        perform: () => goExternal(p.href),
    })),
    {
        id: "action:email",
        label: "Email me",
        sublabel: SITE.email,
        icon: <IconMail />,
        group: "Actions",
        perform: () => mailTo(SITE.email),
    },
    {
        id: "action:linkedin",
        label: "Go to my LinkedIn",
        icon: <IconLinkedIn />,
        group: "Actions",
        perform: () => goExternal(SITE.socials.linkedin),
    },
    {
        id: "action:copy",
        label: "Copy link",
        icon: <IconCopy />,
        group: "Actions",
        perform: copyLink,
    },
];

export default function CommandPalette({ maxHeight }: Props) {
    const [query, setQuery] = useState("");
    const [notes, setNotes] = useState<SearchItem[]>([]);
    const [fuse, setFuse] = useState<Fuse<SearchItem> | null>(null);
    const [selected, setSelected] = useState(0);
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch("/search-index.json")
            .then((r) => r.json())
            .then((data: SearchItem[]) => {
                setNotes(data);
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
                        includeMatches: true,
                    })
                );
            });
    }, []);

    // Build the grouped result set and a flat list for keyboard navigation.
    const { groups, flat } = useMemo(() => {
        const q = query.trim();
        const lower = q.toLowerCase();

        // Empty box: one line per row (names only). Second lines (project
        // descriptions, email address, note descriptions/excerpts) appear only
        // once you type, when they help you choose.
        // Match only text the row shows: its label and (for projects and email)
        // its second line. Each typed word must start a word there, so "fi"
        // doesn't match the middle of "profile".
        const typedWords = lower.split(/\s+/).filter(Boolean);
        const cmds = q
            ? STATIC_COMMANDS.filter((c) => {
                  const words = `${c.label} ${typeof c.sublabel === "string" ? c.sublabel : ""}`.toLowerCase().split(/[^a-z0-9]+/);
                  return typedWords.every((t) => words.some((w) => w.startsWith(t)));
              })
            : STATIC_COMMANDS.map((c) => ({ ...c, sublabel: undefined }));

        // With no query: every page (e.g. the colophon) plus the 5 newest notes.
        // Fuzzy matching forgives typos in titles and tags, but across a long
        // note body it also "matches" unrelated words (sort → short, cursor).
        // So a result must contain the query (or its longest word) at a word
        // start, or, for queries of 4+ characters, have fuzzy-matched on its
        // title or tags (short queries fuzzy-match almost any title).
        const noteMatches: SearchItem[] = q
            ? fuse
                ? fuse
                      .search(q)
                      .filter(
                          (r) =>
                              findTerm(`${r.item.title} ${r.item.tags.join(" ")} ${r.item.description} ${r.item.body}`, q) ||
                              (q.length >= 4 && r.matches?.some((m) => m.key === "title" || m.key === "tags"))
                      )
                      .map((r) => r.item)
                : []
            : [
                  ...notes.filter((n) => n.kind === "page"),
                  ...notes
                      .filter((n) => n.kind === "note")
                      .sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1))
                      .slice(0, 5),
              ];

        // Pages are listed under "Go to"; notes under Notes / Recent notes.
        const noteCmds: Command[] = noteMatches.map((n) => {
            const sub = q ? resultSublabel(n, q) : { node: undefined, excerpt: false };
            return n.kind === "page"
                ? {
                      id: `page:${n.url}`,
                      label: n.title,
                      // Go to rows are text-only, like Home and Notes; a page
                      // only gets a second line when it's showing a search excerpt.
                      sublabel: sub.excerpt ? sub.node : undefined,
                      excerpt: sub.excerpt,
                      group: "Go to",
                      perform: () => goInternal(n.url),
                  }
                : {
                      id: `note:${n.url}`,
                      label: n.title,
                      sublabel: sub.node,
                      excerpt: sub.excerpt,
                      hint: formatDate(n.pubDate),
                      group: q ? "Notes" : "Recent notes",
                      perform: () => goInternal(n.url),
                  };
        });

        // Writing first, then links that leave the site, then actions.
        const order = q
            ? ["Go to", "Notes", "Projects", "Actions"]
            : ["Go to", "Recent notes", "Projects", "Actions"];
        const all = [...cmds, ...noteCmds];

        let idx = 0;
        const flatList: (Command & { index: number })[] = [];
        const grouped = order
            .map((label) => ({
                label,
                items: all
                    .filter((i) => i.group === label)
                    .map((it) => {
                        const withIndex = { ...it, index: idx++ };
                        flatList.push(withIndex);
                        return withIndex;
                    }),
            }))
            .filter((g) => g.items.length > 0);

        return { groups: grouped, flat: flatList };
    }, [query, fuse, notes]);

    // Reset the highlight whenever the visible list changes.
    useEffect(() => {
        setSelected(0);
    }, [groups]);

    // Keep the highlighted row in view as you arrow through.
    useEffect(() => {
        listRef.current
            ?.querySelector(`[data-index="${selected}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    // Run an item's action. "Copy link" is special-cased to flash a "Copied"
    // confirmation before dismissing, rather than closing silently.
    const runItem = (item: Command) => {
        item.perform();
        if (item.id === "action:copy") {
            setCopied(true);
            window.setTimeout(() => {
                setCopied(false);
                closePalette();
            }, 1200);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (flat.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelected((i) => (i + 1) % flat.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((i) => (i - 1 + flat.length) % flat.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const sel = flat[Math.min(selected, flat.length - 1)];
            if (sel) runItem(sel);
        }
    };

    return (
        <div className="command-palette">
            {/* Input — text-base (16px) on mobile stops iOS auto-zoom on focus; text-sm on desktop.
                On mobile, an iOS-style "Close" beside the field dismisses the palette. */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search or jump to…"
                        className="w-full px-4 py-2.5 pr-10 rounded-md border border-muted bg-surface text-foreground text-base md:text-sm font-normal placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 transition-colors"
                        aria-label="Search or run a command"
                        autoComplete="off"
                    />
                    {query && (
                        <button
                            onClick={() => {
                                setQuery("");
                                inputRef.current?.focus();
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => closePalette()}
                    className="md:hidden shrink-0 pl-1 text-sm text-muted-foreground"
                    aria-label="Close"
                >
                    Close
                </button>
            </div>

            {/* Results — negative margin + padding keeps the scrollbar in the
                right gutter with a gap from the row content. */}
            <div
                ref={listRef}
                className="palette-scroll mt-3 overflow-y-auto -mr-2 pr-2"
                style={maxHeight ? { maxHeight } : undefined}
            >
                {flat.length === 0 ? (
                    <p className="text-muted-foreground text-sm px-2 py-6 text-center">
                        No results for &ldquo;{query}&rdquo;
                    </p>
                ) : (
                    groups.map((group) => (
                        <div key={group.label} className="mb-3 last:mb-0">
                            <div className="px-2 mb-1 text-[calc(0.7rem*var(--type-scale))] font-medium uppercase tracking-wide text-muted-foreground">
                                {group.label}
                            </div>
                            <ul>
                                {group.items.map((item) => {
                                    const active = item.index === selected;
                                    const justCopied = copied && item.id === "action:copy";
                                    return (
                                        <li key={item.id}>
                                            <button
                                                data-index={item.index}
                                                onMouseMove={() => setSelected(item.index)}
                                                onClick={() => runItem(item)}
                                                className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${
                                                    active ? "bg-foreground/8" : ""
                                                }`}
                                            >
                                                {item.icon && (
                                                    <span className="text-muted-foreground shrink-0">
                                                        {justCopied ? <IconCheck /> : item.icon}
                                                    </span>
                                                )}
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm text-foreground leading-snug truncate">
                                                        {justCopied ? "Copied" : item.label}
                                                    </span>
                                                    {item.sublabel && (
                                                        <span className={`block text-xs text-muted-foreground leading-snug ${item.excerpt ? "line-clamp-2" : "truncate"}`}>
                                                            {item.sublabel}
                                                        </span>
                                                    )}
                                                </span>
                                                {item.external ? (
                                                    <IconExternalLink active={active} />
                                                ) : item.hint ? (
                                                    <span className="text-xs text-muted-foreground shrink-0">
                                                        {item.hint}
                                                    </span>
                                                ) : null}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
