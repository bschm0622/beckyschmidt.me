import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, placeholder } from '@codemirror/view';
import type { EditorView as EditorViewType } from '@codemirror/view';
import MarkdownIt from 'markdown-it';
import { slugifyStr } from '@/lib/slugify';
import { validateImage, optimizeImage } from '@/lib/images';
import { parseFrontmatter, parseTagsValue, serializeFrontmatter } from '@/lib/frontmatter';
import { DEFAULT_BRANCH } from '@/lib/constants';
import { checkSession, getNote, prStatus, publishNote } from '@/lib/cms-api';
import { useMobileFormattingBar } from './hooks/useMobileFormattingBar';
import { useDraftSafety } from './hooks/useDraftSafety';

interface FrontMatter {
  title: string;
  slug: string;
  pubDate: string;
  description: string;
  author: string;
  tags: string;
}

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

  // Mobile formatting bar — the delicate visual-viewport tracking lives in the
  // hook; see its comments for why it writes to the DOM instead of state.
  const { barRef, editorBoxRef, barFloating, handleEditorFocus, handleEditorBlur, suppressCmScroll } =
    useMobileFormattingBar(tab === 'write');

  // Draft-safety state
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  // Memoized so unrelated re-renders don't reset the hook's autosave debounce.
  const draftSnapshot = useMemo(
    () => ({ frontMatter, markdownContent }),
    [frontMatter, markdownContent],
  );
  const { pendingDraft, restoreDraft, discardDraft, clearDraft } = useDraftSafety({
    draftKey,
    snapshot: draftSnapshot,
    hasUnsavedChanges,
    onRestore: (draft) => {
      setFrontMatter(draft.frontMatter);
      setMarkdownContent(draft.markdownContent);
      setSlugEdited(true);
      setHasUnsavedChanges(true);
    },
  });

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

  // Confirm the session with the server, then load content.
  useEffect(() => {
    (async () => {
      try {
        const data = await checkSession();
        if (!data.authenticated) {
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
      const branch = branchParam && branchParam !== DEFAULT_BRANCH ? branchParam : null;
      setDraftKey(`note-draft:${hasFile ? filename : 'new'}`);

      if (hasFile) {
        setCurrentFile(filename);
        setSlugEdited(true); // existing note already has a slug (its filename)
        if (branch) {
          // Resume the existing PR: load from its branch and hydrate the
          // session so publishing updates the same PR.
          setSessionBranch(branch);
          if (prParam) setPrNumber(Number(prParam));
          hydratePrStatus(branch);
        }
        await loadFileContent(filename!, branch || DEFAULT_BRANCH);
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

  // Look up the open PR for a branch and hydrate the PR number/url so the top bar
  // shows "Published · PR #n" and repeat publishes update it instead of opening a
  // new one.
  const hydratePrStatus = async (branch: string) => {
    try {
      const data = await prStatus(branch);
      if (data.hasPR && data.pullRequest) {
        setPrNumber(data.pullRequest.number);
        setPrUrl(data.pullRequest.url);
      }
    } catch {
      // best effort — the branch state alone still lets publish update the PR
    }
  };

  const loadFileContent = async (filename: string, branch: string = DEFAULT_BRANCH) => {
    try {
      setError('');
      const data = await getNote(filename, branch);
      if (!data || !data.content) throw new Error('File content is empty or missing');
      setCurrentFileSha(data.sha);
      applyMarkdownDocument(data.content, filename.replace(/\.md$/, ''));
    } catch (err: any) {
      setError(`Failed to load ${filename}: ${err.message}`);
    }
  };

  // Hydrate the editor from a raw markdown document. The schema no longer has
  // a `slug` field (the filename is the slug), so notes without one fall back
  // to `fallbackSlug`; legacy notes that still carry `slug:` keep it.
  const applyMarkdownDocument = (content: string, fallbackSlug: string) => {
    if (!content || typeof content !== 'string') {
      setError('Invalid file content received');
      return;
    }
    const { data, body } = parseFrontmatter(content);
    setFrontMatter((prev) => {
      const parsed = { ...prev };
      for (const key of Object.keys(parsed) as Array<keyof FrontMatter>) {
        const value = data[key];
        if (value !== undefined) parsed[key] = Array.isArray(value) ? value.join(', ') : value;
      }
      // Store tags as a friendly comma list for the input.
      parsed.tags = parseTagsValue(data.tags ?? []).join(', ');
      if (!parsed.slug) parsed.slug = fallbackSlug;
      return parsed;
    });
    setMarkdownContent(body.trim());
  };

  const generateFullMarkdown = () =>
    serializeFrontmatter(
      {
        title: frontMatter.title,
        pubDate: frontMatter.pubDate,
        description: frontMatter.description,
        author: frontMatter.author,
        tags: parseTagsValue(frontMatter.tags),
      },
      markdownContent,
    );

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

  // Build the editor config ONCE. Rebuilding these inline on every render makes
  // react-codemirror reconfigure the editor, which can trigger a scroll-into-view
  // that fires a scroll event, re-renders us, and loops — the "jumping" on long
  // paragraphs. Memoizing keeps the editor stable across re-renders.
  const editorExtensions = useMemo(
    () => [markdown(), EditorView.lineWrapping, writingTheme, placeholder(WRITING_PLACEHOLDER), proseInputBehavior, suppressCmScroll],
    [suppressCmScroll],
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

      const result = await publishNote({
        slug,
        filename,
        content: generateFullMarkdown(),
        title: frontMatter.title,
        description: frontMatter.description,
        isUpdate: !!currentFile,
        branch: sessionBranch,
        sha: sessionSha || currentFileSha,
        prNumber,
        images: pendingImages,
      });

      setSessionBranch(result.branch);
      setPendingImages([]);
      setCurrentFile(filename);
      setSessionSha(result.sha);

      if (result.createdPr && result.pullRequest) {
        setPrNumber(result.pullRequest.number);
        setPrUrl(result.pullRequest.url);
        showSuccess(`Saved — opened PR #${result.pullRequest.number}. Merge it to publish.`);
      } else {
        showSuccess(`Updated PR #${prNumber}.`);
      }

      setHasUnsavedChanges(false);
      clearDraft();
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
