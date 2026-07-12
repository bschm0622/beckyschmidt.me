import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, placeholder } from '@codemirror/view';
import type { EditorView as EditorViewType } from '@codemirror/view';
import MarkdownIt from 'markdown-it';
import { slugifyStr } from '../utils/Slugify';
import { validateImage, optimizeImage } from '../utils/imageProcessor';

interface FrontMatter {
  title: string;
  slug: string;
  pubDate: string;
  description: string;
  author: string;
  tags: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// A writing surface, not a code IDE: no gutters, prose font, comfortable
// leading, and a transparent background so it sits flat on the page.
const writingTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', fontSize: '16px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'inherit',
    lineHeight: '1.75',
    padding: '0',
    caretColor: 'var(--color-foreground)',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--color-foreground)' },
  '.cm-placeholder': { color: 'var(--color-muted-foreground)', fontStyle: 'italic' },
});

const WRITING_PLACEHOLDER = 'Write in Markdown — # heading, **bold**, [link](url)…';

// CodeMirror defaults to a *code* editor and disables autocapitalize/autocorrect/
// spellcheck on its content element. This is a prose surface, so turn them back on
// — otherwise mobile keyboards won't capitalize sentences or fix typos.
const proseInputBehavior = EditorView.contentAttributes.of({
  autocapitalize: 'sentences',
  autocorrect: 'on',
  spellcheck: 'true',
});

// Tags are edited as a friendly comma list but stored as the array literal the
// existing notes use (e.g. ["ai","product"]). These convert between the two.
const parseTagsValue = (raw: string): string[] => {
  if (!raw) return [];
  let s = raw.trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      s = s.slice(1, -1);
    }
  }
  return s
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
};
const tagsToLiteral = (tags: string[]) => `[${tags.map((t) => `"${t.replace(/"/g, '')}"`).join(',')}]`;

export default function NoteEditor() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [frontMatter, setFrontMatter] = useState<FrontMatter>({
    title: '',
    slug: '',
    pubDate: new Date().toISOString().split('T')[0],
    description: '',
    author: 'Becky Schmidt',
    tags: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');

  const [markdownContent, setMarkdownContent] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [showDetails, setShowDetails] = useState(true);

  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentFileSha, setCurrentFileSha] = useState<string | null>(null);

  // One-click publish tracks the working branch/PR it created so repeat
  // publishes update the same PR instead of opening new ones.
  const [sessionBranch, setSessionBranch] = useState<string | null>(null);
  const [sessionSha, setSessionSha] = useState<string | null>(null);
  const [prNumber, setPrNumber] = useState<number | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorViewRef = useRef<EditorViewType | null>(null);
  const [pendingImages, setPendingImages] = useState<Array<{ file: File; placeholder: string; filename: string }>>([]);
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light');

  // Mobile formatting bar. On phones, page-level `sticky top-0` fights the caret
  // scroll + keyboard resize on iOS and flickers. Instead we keep a SINGLE scroll
  // area (the page) and, while the editor is focused, float the bar at the TOP of
  // the visible area by tracking the visual viewport. The caret sits at the
  // bottom (just above the keyboard), so a top bar never overlaps it.
  const [isMobile, setIsMobile] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  // The floating bar is positioned by writing its `top` directly to the DOM (see
  // positionBar) rather than through React state — so scrolling never triggers a
  // re-render, which is what could feed back into CodeMirror and cause a scroll
  // loop. Refs, not state, for exactly that reason.
  const barRef = useRef<HTMLDivElement | null>(null);
  const editorBoxRef = useRef<HTMLDivElement | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draft-safety state
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [pendingDraft, setPendingDraft] = useState<{ frontMatter: FrontMatter; markdownContent: string } | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current snapshot so the unload flush persists the latest edit
  // (the debounced autosave can otherwise lose the last <800ms of typing).
  const latestDraftRef = useRef({ frontMatter, markdownContent, draftKey, hasUnsavedChanges });
  latestDraftRef.current = { frontMatter, markdownContent, draftKey, hasUnsavedChanges };

  const showSuccess = (text: string) => {
    setSuccessMessage(text);
    window.setTimeout(() => setSuccessMessage(''), 6000);
  };

  const mdParser = new MarkdownIt();

  // Render pending (not-yet-uploaded) images as placeholders; add error/lazy
  // handling to real ones.
  const defaultRender =
    mdParser.renderer.rules.image ||
    function (tokens, idx, options, _env, self) {
      return self.renderToken(tokens, idx, options);
    };
  mdParser.renderer.rules.image = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const srcIndex = token.attrIndex('src');
    const altIndex = token.attrIndex('alt');
    if (srcIndex >= 0) {
      const src = token.attrs![srcIndex][1];
      const alt = altIndex >= 0 ? token.attrs![altIndex][1] : 'Image';
      if (src.startsWith('/notes-images/')) {
        return `<div class="border border-dashed border-muted rounded p-4 text-center text-muted-foreground my-4">
          <p class="text-sm">Image: ${alt}</p>
          <p class="text-xs mt-1 opacity-75">(uploads when you publish)</p>
        </div>`;
      }
      token.attrPush(['onerror', "this.style.display='none'"]);
      token.attrPush(['loading', 'lazy']);
    }
    return defaultRender(tokens, idx, options, env, self);
  };

  // Keep the editor theme in sync with the site's light/dark toggle.
  useEffect(() => {
    const updateTheme = () => {
      setEditorTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Track whether we're on a phone-width screen (drives the bottom-pinned bar).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Put the bar at the top of the visible area (visual-viewport offset), clamped
  // to the editor's own top so it never rides up over the details. Writes `top`
  // straight to the DOM — no React state, so scrolling can't re-render us.
  const positionBar = useCallback(() => {
    const vv = window.visualViewport;
    const bar = barRef.current;
    if (!vv || !bar) return;
    const top = vv.offsetTop;
    const editorTop = editorBoxRef.current?.getBoundingClientRect().top ?? top;
    bar.style.top = `${Math.round(Math.max(top, editorTop))}px`;
  }, []);

  // Reposition on visual-viewport resize + scroll (iOS fires these as the
  // keyboard animates) and window scroll (the editor's top moves as the page
  // scrolls), coalesced to one measurement per frame.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        positionBar();
      });
    };
    vv.addEventListener('resize', onScroll);
    vv.addEventListener('scroll', onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener('resize', onScroll);
      vv.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, [positionBar]);

  // Confirm the session with the server, then load content.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (!data.authenticated) {
          localStorage.removeItem('admin-authenticated');
          window.location.href = '/admin';
          return;
        }
      } catch {
        window.location.href = '/admin';
        return;
      }

      setIsAuthenticated(true);

      const urlParams = new URLSearchParams(window.location.search);
      const filename = urlParams.get('file');
      const hasFile = !!(filename && filename !== 'null' && filename !== 'undefined');
      // When reopening a note that's still "In review", the dashboard passes the
      // PR's branch (and number) so we load that version and resume the same PR.
      const branchParam = urlParams.get('branch');
      const prParam = urlParams.get('pr');
      const branch = branchParam && branchParam !== 'master' ? branchParam : null;
      const key = `note-draft:${hasFile ? filename : 'new'}`;
      setDraftKey(key);

      if (hasFile) {
        setCurrentFile(filename);
        setSlugEdited(true); // existing note already has a slug
        if (branch) {
          // Resume the existing PR: load from its branch and hydrate the
          // session so publishing updates the same PR.
          setSessionBranch(branch);
          if (prParam) setPrNumber(Number(prParam));
          hydratePrStatus(branch);
        }
        await loadFileContent(filename!, branch || 'master');
      } else {
        parseMarkdownWithFrontMatter(`---
title: ""
slug: ""
pubDate: "${new Date().toISOString().split('T')[0]}"
description: ""
author: "Becky Schmidt"
tags: ""
---

`);
      }

      try {
        const saved = localStorage.getItem(key);
        if (saved) setPendingDraft(JSON.parse(saved));
      } catch {
        // corrupt draft — ignore
      }

      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    updatePreview(markdownContent);
  }, [markdownContent]);

  // Load the universe of existing tags (from the published search index) so we
  // can suggest them and avoid accidental duplicates.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/search-index.json');
        if (!res.ok) return;
        const data = await res.json();
        const set = new Set<string>();
        (data as any[]).forEach((item) => (item.tags || []).forEach((t: string) => set.add(t)));
        setAllTags([...set].sort((a, b) => a.localeCompare(b)));
      } catch {
        // No suggestions if it can't load — the field still works.
      }
    })();
  }, []);

  // Debounced local autosave so a tab close/crash never loses work.
  useEffect(() => {
    if (!draftKey || !hasUnsavedChanges) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ frontMatter, markdownContent }));
      } catch {
        // storage unavailable — best effort
      }
    }, 800);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [frontMatter, markdownContent, hasUnsavedChanges, draftKey]);

  // Flush the current draft synchronously before the page goes away, and warn
  // on unsaved changes. Reads from the ref so it always sees the latest edit;
  // `pagehide` covers mobile Safari, which often skips `beforeunload`.
  useEffect(() => {
    const flush = () => {
      const { frontMatter: fm, markdownContent: md, draftKey: key, hasUnsavedChanges: dirty } = latestDraftRef.current;
      if (dirty && key) {
        try {
          localStorage.setItem(key, JSON.stringify({ frontMatter: fm, markdownContent: md }));
        } catch {
          // best effort
        }
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      if (latestDraftRef.current.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const restoreDraft = () => {
    if (pendingDraft) {
      setFrontMatter(pendingDraft.frontMatter);
      setMarkdownContent(pendingDraft.markdownContent);
      setSlugEdited(true);
      setHasUnsavedChanges(true);
    }
    setPendingDraft(null);
  };
  const discardDraft = () => {
    try {
      if (draftKey) localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    setPendingDraft(null);
  };

  // Look up the open PR for a branch and hydrate the PR number/url so the top bar
  // shows "Published · PR #n" and repeat publishes update it instead of opening a
  // new one.
  const hydratePrStatus = async (branch: string) => {
    try {
      const res = await fetch(`/api/github/pr-status?branch=${encodeURIComponent(branch)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.hasPR && data.pullRequest) {
        setPrNumber(data.pullRequest.number);
        setPrUrl(data.pullRequest.url);
      }
    } catch {
      // best effort — the branch state alone still lets publish update the PR
    }
  };

  const loadFileContent = async (filename: string, branch: string = 'master') => {
    try {
      setError('');
      const response = await fetch(`/api/github/file/src/notes/${filename}?branch=${encodeURIComponent(branch)}`, {
        method: 'GET',
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to load file`);
      }
      const data = await response.json();
      if (!data || !data.content) throw new Error('File content is empty or missing');
      setCurrentFileSha(data.sha);
      parseMarkdownWithFrontMatter(data.content);
    } catch (err: any) {
      setError(`Failed to load ${filename}: ${err.message}`);
    }
  };

  const parseMarkdownWithFrontMatter = (content: string) => {
    if (!content || typeof content !== 'string') {
      setError('Invalid file content received');
      return;
    }
    const frontMatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    if (match) {
      const [, frontMatterStr, contentStr] = match;
      const parsed = { ...frontMatter };
      if (frontMatterStr) {
        frontMatterStr.split('\n').forEach((line) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }
            if (key in parsed) (parsed as any)[key] = value;
          }
        });
      }
      // Store tags as a friendly comma list for the input.
      parsed.tags = parseTagsValue(parsed.tags).join(', ');
      setFrontMatter(parsed);
      setMarkdownContent(contentStr ? contentStr.trim() : '');
    } else {
      setMarkdownContent(content.trim());
    }
  };

  const generateFullMarkdown = () => {
    const fm = `---
title: "${frontMatter.title}"
slug: "${frontMatter.slug}"
pubDate: "${frontMatter.pubDate}"
author: "${frontMatter.author}"
description: "${frontMatter.description}"
tags: ${tagsToLiteral(parseTagsValue(frontMatter.tags))}
---`;
    return `${fm}\n\n${markdownContent}\n`;
  };

  const handleTitleChange = (value: string) => {
    setFrontMatter((prev) => ({
      ...prev,
      title: value,
      slug: slugEdited ? prev.slug : slugifyStr(value),
    }));
    setHasUnsavedChanges(true);
  };

  const handleFrontMatterChange = (field: keyof FrontMatter, value: string) => {
    if (field === 'slug') setSlugEdited(true);
    setFrontMatter((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdownContent(value);
    setHasUnsavedChanges(true);
  }, []);

  // Focus tracking for the bottom bar. Delay the blur so tapping a toolbar
  // button (which briefly steals focus) doesn't drop and re-pin the bar.
  const handleEditorFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setEditorFocused(true);
  }, []);
  const handleEditorBlur = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setEditorFocused(false), 150);
  }, []);

  // Float the formatting bar above the keyboard only on a focused phone editor.
  const barFloating = isMobile && editorFocused && tab === 'write';

  // Position it the moment it appears (on focus), before the first paint jump.
  useEffect(() => {
    if (barFloating) positionBar();
  }, [barFloating, positionBar]);

  // Build the editor config ONCE. Rebuilding these inline on every render makes
  // react-codemirror reconfigure the editor, which can trigger a scroll-into-view
  // that fires a scroll event, re-renders us, and loops — the "jumping" on long
  // paragraphs. Memoizing keeps the editor stable across re-renders.
  const editorExtensions = useMemo(
    () => [markdown(), EditorView.lineWrapping, writingTheme, placeholder(WRITING_PLACEHOLDER), proseInputBehavior],
    [],
  );
  const editorBasicSetup = useMemo(
    () => ({
      lineNumbers: false,
      foldGutter: false,
      highlightActiveLine: false,
      highlightActiveLineGutter: false,
      dropCursor: false,
      allowMultipleSelections: false,
      indentOnInput: true,
      bracketMatching: false,
      closeBrackets: false,
      autocompletion: false,
      highlightSelectionMatches: false,
    }),
    [],
  );

  // --- Tags chips ---
  const selectedTags = parseTagsValue(frontMatter.tags);
  const setTags = (arr: string[]) => handleFrontMatterChange('tags', arr.join(', '));
  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    // Reuse an existing tag's canonical spelling (collapses AI vs ai).
    const canonical = allTags.find((x) => x.toLowerCase() === t.toLowerCase()) || t;
    if (selectedTags.some((x) => x.toLowerCase() === canonical.toLowerCase())) {
      setTagDraft('');
      return;
    }
    setTags([...selectedTags, canonical]);
    setTagDraft('');
  };
  const removeTag = (t: string) => setTags(selectedTags.filter((x) => x !== t));
  const tagSuggestions = allTags
    .filter((t) => !selectedTags.some((s) => s.toLowerCase() === t.toLowerCase()))
    .filter((t) => !tagDraft || t.toLowerCase().includes(tagDraft.toLowerCase()))
    .slice(0, 10);

  const updatePreview = (content: string) => {
    if (!content.trim()) {
      setPreviewHtml('<p class="text-muted-foreground">Nothing to preview yet.</p>');
      return;
    }
    setPreviewHtml(mdParser.render(content));
  };

  // --- Formatting toolbar: inserts markdown so you don't have to type it
  // (especially handy on mobile). All operate on the CodeMirror selection. ---
  const applyWrap = (before: string, after = before) => {
    const view = editorViewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: selected
        ? { anchor: from + before.length, head: from + before.length + selected.length }
        : { anchor: from + before.length },
    });
    view.focus();
    setHasUnsavedChanges(true);
  };

  const applyLinePrefix = (prefix: string) => {
    const view = editorViewRef.current;
    if (!view) return;
    const { head } = view.state.selection.main;
    const line = view.state.doc.lineAt(head);
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: head + prefix.length },
    });
    view.focus();
    setHasUnsavedChanges(true);
  };

  const insertLink = () => {
    const view = editorViewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to) || 'text';
    const insert = `[${text}](url)`;
    const urlStart = from + text.length + 3; // after `[text](`
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: urlStart, head: urlStart + 3 }, // select `url`
    });
    view.focus();
    setHasUnsavedChanges(true);
  };

  const formatActions: Array<{ label: string; title: string; onClick: () => void; className?: string }> = [
    { label: 'B', title: 'Bold', onClick: () => applyWrap('**'), className: 'font-semibold' },
    { label: 'I', title: 'Italic', onClick: () => applyWrap('*'), className: 'italic' },
    { label: 'H', title: 'Heading', onClick: () => applyLinePrefix('## ') },
    { label: 'Link', title: 'Link', onClick: insertLink },
    { label: 'List', title: 'Bulleted list', onClick: () => applyLinePrefix('- ') },
    { label: 'Quote', title: 'Quote', onClick: () => applyLinePrefix('> ') },
    { label: 'Code', title: 'Inline code', onClick: () => applyWrap('`') },
    { label: 'Code block', title: 'Code block', onClick: () => applyWrap('```\n', '\n```') },
  ];

  // One-click publish: auto-branch off master (first time), upload staged
  // images, commit, and open a PR. Repeat publishes reuse the same branch/PR.
  const handlePublish = async () => {
    if (!frontMatter.title.trim() && !markdownContent.trim()) {
      setError('Nothing to save yet — add a title or some content.');
      return;
    }

    setIsPublishing(true);
    setError('');

    try {
      const slug = frontMatter.slug || slugifyStr(frontMatter.title) || 'note';
      if (!frontMatter.slug) setFrontMatter((prev) => ({ ...prev, slug }));
      const filename = currentFile || `${slug}.md`;

      // 1. Branch (once per session).
      let branch = sessionBranch;
      if (!branch) {
        branch = `cms/${slug}-${Date.now().toString(36)}`;
        const br = await fetch('/api/github/create-branch', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ branchName: branch, fromBranch: 'master' }),
        });
        if (!br.ok && br.status !== 409) {
          throw new Error((await br.json()).error || 'Failed to create branch');
        }
        setSessionBranch(branch);
      }

      // 2. Upload any staged images to the branch.
      for (const img of pendingImages) {
        const formData = new FormData();
        formData.append('file', img.file);
        formData.append('slug', slug);
        formData.append('branch', branch);
        formData.append('filename', img.filename);
        formData.append('message', `Add image for ${slug}`);
        const imgRes = await fetch('/api/github/upload-image', { method: 'POST', body: formData });
        if (!imgRes.ok) {
          throw new Error(`Failed to upload image ${img.filename}: ${(await imgRes.json()).error}`);
        }
      }
      setPendingImages([]);

      // 3. Commit the note.
      const sha = sessionSha || currentFileSha;
      const commitRes = await fetch('/api/github/commit', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          content: generateFullMarkdown(),
          filename,
          message: currentFile ? `Update ${filename} via CMS` : `Create ${filename} via CMS`,
          branch,
          ...(sha ? { sha } : {}),
        }),
      });
      const commitData = await commitRes.json();
      if (!commitRes.ok) throw new Error(commitData.error || 'Failed to save');
      setCurrentFile(filename);
      setSessionSha(commitData.content?.sha || null);

      // 4. Open the PR (once).
      if (!prNumber) {
        const prRes = await fetch('/api/github/create-pr', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({
            title: `Add/Update: ${frontMatter.title || filename}`,
            body: frontMatter.description || 'Note updates via CMS',
            head: branch,
            base: 'master',
          }),
        });
        const prData = await prRes.json();
        if (!prRes.ok) throw new Error(prData.error || 'Failed to open PR');
        setPrNumber(prData.pullRequest.number);
        setPrUrl(prData.pullRequest.url);
        showSuccess(`Saved — opened PR #${prData.pullRequest.number}. Merge it to publish.`);
      } else {
        showSuccess(`Updated PR #${prNumber}.`);
      }

      setHasUnsavedChanges(false);
      try {
        if (draftKey) localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadMessage(null);

    const validation = validateImage(file);
    if (!validation.valid) {
      setUploadMessage({ type: 'error', text: validation.error || 'Invalid image' });
      return;
    }
    const slug = frontMatter.slug || slugifyStr(frontMatter.title);
    if (!slug) {
      setUploadMessage({ type: 'error', text: 'Add a title (or slug) before adding images.' });
      return;
    }

    setIsUploadingImage(true);
    try {
      const optimizedFile = await optimizeImage(file);
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
      const filename = `${slug}-${timestamp}-${sanitizedName}`;
      const imagePath = `/notes-images/${slug}/${filename}`;

      setPendingImages((prev) => [...prev, { file: optimizedFile, placeholder: imagePath, filename }]);

      const altText = file.name.split('.')[0];
      const imageMarkdown = `![${altText}](${imagePath})`;
      if (editorViewRef.current) {
        const view = editorViewRef.current;
        const cursorPos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: cursorPos, insert: imageMarkdown },
          selection: { anchor: cursorPos + imageMarkdown.length },
        });
      } else {
        setMarkdownContent((prev) => prev + '\n' + imageMarkdown + '\n');
      }

      setUploadMessage({ type: 'success', text: `Image added — uploads when you publish (${pendingImages.length + 1} pending).` });
      setHasUnsavedChanges(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      window.setTimeout(() => setUploadMessage(null), 5000);
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message || 'Failed to process image' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const goBack = () => {
    if (hasUnsavedChanges) {
      setConfirmingLeave(true);
      return;
    }
    window.location.href = '/admin';
  };

  if (isLoading) {
    return <div className="py-16 text-center text-muted-foreground text-sm">Loading editor…</div>;
  }
  if (!isAuthenticated) return null;

  const statusText = isPublishing
    ? 'Saving…'
    : hasUnsavedChanges
      ? 'Unsaved changes'
      : prNumber
        ? `Saved · PR #${prNumber}`
        : currentFile
          ? 'Saved'
          : 'Draft';

  // The formatting buttons, shared between the inline bar (desktop / unfocused
  // mobile) and the docked bar in full-screen mobile writing mode.
  const formatToolbarButtons = (
    <>
      {formatActions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onClick}
          title={a.title}
          aria-label={a.title}
          className={`min-w-8 rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors ${a.className ?? ''}`}
        >
          {a.label}
        </button>
      ))}
      <span className="mx-1.5 h-4 w-px bg-muted" aria-hidden="true" />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploadingImage}
        title="Add image"
        className="rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
      >
        {isUploadingImage ? 'Processing…' : `Image${pendingImages.length > 0 ? ` (${pendingImages.length})` : ''}`}
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={goBack} className="btn-ghost">← Notes</button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{statusText}</span>
          {prUrl && (
            <a href={prUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              View PR ↗
            </a>
          )}
          <button onClick={handlePublish} disabled={isPublishing || !hasUnsavedChanges} className="btn-primary">
            {isPublishing ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Banners */}
      {pendingDraft && (
        <div className="status-warning flex flex-wrap items-center justify-between gap-3">
          <span>Unsaved draft found for this note.</span>
          <span className="flex gap-4">
            <button onClick={restoreDraft} className="font-medium hover:opacity-80">Restore</button>
            <button onClick={discardDraft} className="hover:opacity-80">Discard</button>
          </span>
        </div>
      )}
      {confirmingLeave && (
        <div className="status-warning flex flex-wrap items-center justify-between gap-3">
          <span>You have unsaved changes. Leave anyway?</span>
          <span className="flex gap-4">
            <button onClick={() => (window.location.href = '/admin')} className="font-medium hover:opacity-80">Leave</button>
            <button onClick={() => setConfirmingLeave(false)} className="hover:opacity-80">Stay</button>
          </span>
        </div>
      )}
      {successMessage && <p className="status-success">{successMessage}</p>}
      {error && (
        <p className="status-error flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')} className="shrink-0 hover:opacity-70" aria-label="Dismiss">×</button>
        </p>
      )}

      {/* Title hero */}
      <input
        type="text"
        value={frontMatter.title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Title"
        className="w-full bg-transparent border-0 p-0 text-3xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/40 placeholder:italic placeholder:font-normal focus:outline-none"
      />

      {/* Details disclosure */}
      <div>
        <button onClick={() => setShowDetails((s) => !s)} className="btn-ghost">
          {showDetails ? 'Hide details' : 'Details'}
          <span className="text-muted-foreground">{showDetails ? '▴' : '▾'}</span>
        </button>
        {showDetails && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Slug</label>
              <input type="text" value={frontMatter.slug} onChange={(e) => handleFrontMatterChange('slug', e.target.value)} className="field-input" placeholder="post-slug" />
            </div>
            <div>
              <label className="field-label">Date</label>
              <input type="date" value={frontMatter.pubDate} onChange={(e) => handleFrontMatterChange('pubDate', e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">Author</label>
              <input type="text" value={frontMatter.author} onChange={(e) => handleFrontMatterChange('author', e.target.value)} className="field-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Tags</label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-muted bg-surface px-2 py-1.5 focus-within:border-foreground/30 transition-colors">
                {selectedTags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded border border-muted px-2 py-0.5 text-sm text-muted-foreground">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="hover:text-foreground" aria-label={`Remove ${t}`}>×</button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag(tagDraft);
                    } else if (e.key === 'Backspace' && !tagDraft && selectedTags.length) {
                      removeTag(selectedTags[selectedTags.length - 1]);
                    }
                  }}
                  onBlur={() => tagDraft && addTag(tagDraft)}
                  placeholder={selectedTags.length ? 'Add tag…' : 'Add tags…'}
                  className="flex-1 min-w-[6rem] bg-transparent text-foreground text-sm placeholder:text-muted-foreground/60 placeholder:italic focus:outline-none py-0.5"
                />
              </div>
              {tagSuggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagSuggestions.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => addTag(t)}
                      className="rounded border border-muted px-2 py-0.5 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Description</label>
              <textarea value={frontMatter.description} onChange={(e) => handleFrontMatterChange('description', e.target.value)} rows={2} className="field-input resize-y" placeholder="Brief description" />
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Editor bar. On desktop the toggle + formatting controls stay pinned to
          the top of the page while you scroll a long note. On a phone this bar is
          static (no sticky = no iOS flicker); once you tap into the editor the
          formatting controls move to a bar floating above the keyboard. */}
      <div className="sm:sticky sm:top-0 z-10 -mx-4 bg-background px-4 pt-2 pb-3 space-y-3">
        {/* Write / Preview toggle */}
        <div className="flex items-center gap-5 border-b border-muted text-sm">
          <button
            onClick={() => setTab('write')}
            className={`-mb-px border-b-2 pb-2 transition-colors ${tab === 'write' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Write
          </button>
          <button
            onClick={() => setTab('preview')}
            className={`-mb-px border-b-2 pb-2 transition-colors ${tab === 'preview' ? 'border-foreground text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Preview
          </button>
        </div>

        {/* Inline formatting toolbar (desktop, or a phone before you tap in). */}
        {tab === 'write' && !barFloating && (
          <div className="flex flex-wrap items-center gap-0.5">{formatToolbarButtons}</div>
        )}
      </div>

      {uploadMessage && (
        <p className={`text-sm ${uploadMessage.type === 'error' ? 'text-danger' : 'text-success'}`}>{uploadMessage.text}</p>
      )}

      {/* Writing surface / preview. The page is the only scroll container. The
          floating bar sits at the top of the visible area, and the caret sits at
          the bottom above the keyboard, so they never overlap. */}
      {tab === 'write' ? (
        <div ref={editorBoxRef} className="min-h-[60vh]">
          <CodeMirror
            value={markdownContent}
            onChange={handleMarkdownChange}
            extensions={editorExtensions}
            theme={editorTheme}
            onFocus={handleEditorFocus}
            onBlur={handleEditorBlur}
            onCreateEditor={(view) => {
              editorViewRef.current = view;
            }}
            basicSetup={editorBasicSetup}
          />
        </div>
      ) : (
        <div className="min-h-[60vh] typography" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      )}

      {/* Formatting bar pinned to the TOP of the visible area (mobile, focused).
          `top` tracks the visual viewport so it rides just under the browser
          chrome; the caret stays at the bottom above the keyboard, clear of it. */}
      {barFloating && (
        <div
          ref={barRef}
          // Keep the editor focused (keyboard open) when a button is tapped, so
          // tapping a control doesn't dismiss the keyboard and drop the bar.
          onMouseDown={(e) => e.preventDefault()}
          className="fixed inset-x-0 top-0 z-30 flex flex-wrap items-center gap-0.5 border-b border-muted bg-background px-4 py-2"
        >
          {formatToolbarButtons}
        </div>
      )}
    </div>
  );
}
