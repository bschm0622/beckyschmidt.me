import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, placeholder } from '@codemirror/view';
import type { EditorView as EditorViewType } from '@codemirror/view';
import MarkdownIt from 'markdown-it';
import { slugifyStr } from '@/lib/slugify';
import { validateImage, optimizeImage, MAX_FILE_SIZE } from '@/lib/images';
import { parseFrontmatter, parseTagsValue, serializeFrontmatter } from '@/lib/frontmatter';
import { DEFAULT_BRANCH } from '@/lib/constants';
import { ApiError, checkSession, getNote, pending as listPending, prStatus, publishNote } from '@/lib/cms-api';
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

interface Snapshot {
  frontMatter: FrontMatter;
  markdownContent: string;
}

// Today's date in the writer's time zone. toISOString() would give the UTC
// date, which is already tomorrow on a US evening.
const today = () => new Date().toLocaleDateString('en-CA');

const emptyFrontMatter = (): FrontMatter => ({
  title: '',
  slug: '',
  pubDate: today(),
  description: '',
  author: 'Becky Schmidt',
  tags: '',
});

// Order-stable key for "has anything changed since the last save?"
const snapshotKey = ({ frontMatter: f, markdownContent }: Snapshot) =>
  JSON.stringify([f.title, f.slug, f.pubDate, f.description, f.author, f.tags, markdownContent]);

const IMAGE_PATH_RE = /\/notes-images\/[^\s)"']+/g;
const imagePaths = (md: string) => new Set(md.match(IMAGE_PATH_RE) ?? []);

// Inserted as an image's alt text and selected, so typing replaces it.
const IMAGE_ALT_PLACEHOLDER = 'Describe the image';

// Build an editor snapshot from a raw markdown document. The schema has no
// `slug` field (the filename is the slug), so notes without one fall back to
// `fallbackSlug`; legacy notes that still carry `slug:` keep it.
function snapshotFromDocument(content: string, fallbackSlug: string): Snapshot {
  const { data, body } = parseFrontmatter(content);
  const frontMatter = emptyFrontMatter();
  for (const key of Object.keys(frontMatter) as Array<keyof FrontMatter>) {
    const value = data[key];
    if (value !== undefined) frontMatter[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  // Store tags as a friendly comma list for the input.
  frontMatter.tags = parseTagsValue(data.tags ?? []).join(', ');
  if (!frontMatter.slug) frontMatter.slug = fallbackSlug;
  return { frontMatter, markdownContent: body.trim() };
}

// Older backups may predate a field; fill gaps with defaults.
const normalizeSnapshot = (s: Partial<Snapshot>): Snapshot => ({
  frontMatter: { ...emptyFrontMatter(), ...(s.frontMatter ?? {}) },
  markdownContent: s.markdownContent ?? '',
});

const formatSavedAt = (savedAt: number | null) =>
  savedAt
    ? new Date(savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'your last visit';

// A writing surface, not a code IDE: no gutters, comfortable
// leading, and a transparent background so it sits flat on the page.
// `&.cm-editor` (two classes) outranks the light/dark theme's white background.
// The text stays in CodeMirror's monospace on purpose: it's a reminder that
// this is Markdown source, not the rendered note.
const writingTheme = EditorView.theme({
  '&.cm-editor': { backgroundColor: 'transparent', fontSize: '16px' },
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

  const [frontMatter, setFrontMatter] = useState<FrontMatter>(emptyFrontMatter);
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
  // snapshotKey() of the last saved/loaded version; null until loaded.
  const [savedKey, setSavedKey] = useState<string | null>(null);

  // Image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorViewRef = useRef<EditorViewType | null>(null);
  // Images added this session, uploaded on the next save. `folder` is the
  // public/notes-images/ subfolder the markdown points at; it's fixed when the
  // first image is added, so renaming the note later can't break the paths.
  const [pendingImages, setPendingImages] = useState<Array<{ file: File; path: string; folder: string; filename: string }>>([]);
  const imageFolderRef = useRef<string | null>(null);
  // Local previews for images that aren't on the site yet (path → object URL).
  const previewUrlsRef = useRef(new Map<string, string>());
  // Image paths in the last saved version, and paths from a restored backup
  // whose files were lost with the old tab (only the text is backed up).
  const savedImagesRef = useRef(new Set<string>());
  const lostImagesRef = useRef(new Set<string>());
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light');

  // Mobile formatting bar — the delicate visual-viewport tracking lives in the
  // hook; see its comments for why it writes to the DOM instead of state.
  const { barRef, editorBoxRef, barFloating, handleEditorFocus, handleEditorBlur, suppressCmScroll } =
    useMobileFormattingBar(tab === 'write');

  // Draft-safety state
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  // Set when unsaved edits from a previous visit were loaded automatically.
  const [restored, setRestored] = useState<{ savedAt: number | null; loaded: Snapshot } | null>(null);
  // Memoized so unrelated re-renders don't reset the hook's autosave debounce.
  const draftSnapshot = useMemo<Snapshot>(
    () => ({ frontMatter, markdownContent }),
    [frontMatter, markdownContent],
  );
  // Unsaved = differs from the last saved version, so undoing an edit counts.
  const hasUnsavedChanges = useMemo(
    () => savedKey !== null && snapshotKey(draftSnapshot) !== savedKey,
    [draftSnapshot, savedKey],
  );
  const { readBackup, clearBackup, discardAndLeave } = useDraftSafety<Snapshot>({
    draftKey,
    snapshot: draftSnapshot,
    dirty: hasUnsavedChanges,
  });

  const applySnapshot = (snap: Snapshot) => {
    setFrontMatter(snap.frontMatter);
    setMarkdownContent(snap.markdownContent);
  };

  const showSuccess = (text: string) => {
    setSuccessMessage(text);
    window.setTimeout(() => setSuccessMessage(''), 6000);
  };

  // Built once. Images added this session aren't on the site yet, so the
  // preview shows the local copy; others load from the site as usual.
  const mdParser = useMemo(() => {
    const md = new MarkdownIt();
    const defaultRender =
      md.renderer.rules.image ||
      function (tokens, idx, options, _env, self) {
        return self.renderToken(tokens, idx, options);
      };
    md.renderer.rules.image = function (tokens, idx, options, env, self) {
      const token = tokens[idx];
      const srcIndex = token.attrIndex('src');
      if (srcIndex >= 0) {
        const local = previewUrlsRef.current.get(token.attrs![srcIndex][1]);
        if (local) token.attrs![srcIndex][1] = local;
        token.attrPush(['onerror', "this.style.display='none'"]);
        token.attrPush(['loading', 'lazy']);
      }
      return defaultRender(tokens, idx, options, env, self);
    };
    return md;
  }, []);

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
      const key = `note-draft:${hasFile ? filename : 'new'}`;

      let loaded: Snapshot = { frontMatter: emptyFrontMatter(), markdownContent: '' };
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
        const doc = await loadFileContent(filename!, branch || DEFAULT_BRANCH);
        if (!doc) {
          // Leave saving disabled (no saved version to compare against) so a
          // failed load can't be saved over the real note.
          setIsLoading(false);
          return;
        }
        loaded = doc;
      }

      applySnapshot(loaded);
      setSavedKey(snapshotKey(loaded));
      savedImagesRef.current = imagePaths(loaded.markdownContent);

      // Unsaved edits from a previous visit (tab closed, crash, phone dropped
      // the page) come back automatically, with a link to revert.
      const backup = readBackup(key);
      if (backup) {
        const snap = normalizeSnapshot(backup.snapshot);
        if (snapshotKey(snap) !== snapshotKey(loaded)) {
          applySnapshot(snap);
          setSlugEdited(hasFile || snap.frontMatter.slug !== slugifyStr(snap.frontMatter.title));
          setRestored({ savedAt: backup.savedAt, loaded });
          const loadedPaths = imagePaths(loaded.markdownContent);
          lostImagesRef.current = new Set([...imagePaths(snap.markdownContent)].filter((p) => !loadedPaths.has(p)));
        } else {
          clearBackup(key);
        }
      }

      setDraftKey(key);
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

  const loadFileContent = async (filename: string, branch: string = DEFAULT_BRANCH): Promise<Snapshot | null> => {
    try {
      setError('');
      const data = await getNote(filename, branch);
      if (!data || typeof data.content !== 'string' || !data.content) throw new Error('File content is empty or missing');
      setCurrentFileSha(data.sha);
      return snapshotFromDocument(data.content, filename.replace(/\.md$/, ''));
    } catch (err: any) {
      setError(`Failed to load ${filename}: ${err.message}`);
      return null;
    }
  };

  // Put the editor back to the last saved version and drop the backup.
  const revertToSaved = () => {
    if (!restored) return;
    applySnapshot(restored.loaded);
    setSlugEdited(!!currentFile);
    clearBackup();
    lostImagesRef.current = new Set();
    setRestored(null);
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
  };

  const handleFrontMatterChange = (field: keyof FrontMatter, value: string) => {
    if (field === 'slug') setSlugEdited(true);
    setFrontMatter((prev) => ({ ...prev, [field]: value }));
  };

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdownContent(value);
  }, []);

  // Paste or drop image files straight into the editor. The handler is built
  // once (see editorExtensions), so it calls through a ref to the latest
  // addImageFiles.
  const addImageFilesRef = useRef<(files: File[], at?: number) => void>(() => {});
  const imagePasteDrop = useMemo(
    () =>
      EditorView.domEventHandlers({
        paste(event) {
          const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          event.preventDefault();
          addImageFilesRef.current(files);
          return true;
        },
        drop(event, view) {
          const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          event.preventDefault();
          const at = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? undefined;
          addImageFilesRef.current(files, at);
          return true;
        },
      }),
    [],
  );

  // Build the editor config ONCE. Rebuilding these inline on every render makes
  // react-codemirror reconfigure the editor, which can trigger a scroll-into-view
  // that fires a scroll event, re-renders us, and loops — the "jumping" on long
  // paragraphs. Memoizing keeps the editor stable across re-renders.
  const editorExtensions = useMemo(
    () => [markdown(), EditorView.lineWrapping, writingTheme, placeholder(WRITING_PLACEHOLDER), proseInputBehavior, suppressCmScroll, imagePasteDrop],
    [suppressCmScroll, imagePasteDrop],
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

  // A new note's filename is its URL, so it can't match a published note or
  // one that's still in review.
  const assertSlugAvailable = async (filename: string) => {
    const url = `/notes/${filename.replace(/\.md$/, '')}/`;
    try {
      await getNote(filename);
      throw new Error(`There's already a note at ${url}. Change the slug under Details.`);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
    const { pending } = await listPending();
    if (pending.some((pr) => pr.filename === filename && !pr.isDelete)) {
      throw new Error(`A note at ${url} is already in review. Change the slug under Details.`);
    }
  };

  // One-click publish: auto-branch off master (first time), upload staged
  // images, commit, and open a PR. Repeat publishes reuse the same branch/PR.
  const handlePublish = async () => {
    if (!frontMatter.title.trim()) {
      setError('Add a title before saving.');
      return;
    }
    if (markdownContent.includes(`![${IMAGE_ALT_PLACEHOLDER}]`)) {
      setError(`Add a short description to each image (replace "${IMAGE_ALT_PLACEHOLDER}").`);
      return;
    }
    const lost = [...imagePaths(markdownContent)].filter((p) => lostImagesRef.current.has(p));
    if (lost.length) {
      setError(
        `${lost.length === 1 ? 'An image' : `${lost.length} images`} from your unsaved changes didn't survive closing the page. Delete ${lost.length === 1 ? 'its line' : 'those lines'} and add ${lost.length === 1 ? 'it' : 'them'} again.`,
      );
      return;
    }

    const isNew = !currentFile;
    const slug = isNew
      ? slugifyStr(frontMatter.slug || frontMatter.title) || 'note'
      : currentFile!.replace(/\.md$/, '');
    const filename = currentFile || `${slug}.md`;
    // Only upload images the note still uses.
    const images = pendingImages.filter((img) => markdownContent.includes(img.path));
    const saved: Snapshot = { frontMatter: { ...frontMatter, slug }, markdownContent };

    setIsPublishing(true);
    setError('');

    try {
      if (isNew) await assertSlugAvailable(filename);

      const result = await publishNote({
        slug,
        filename,
        content: generateFullMarkdown(),
        title: frontMatter.title,
        description: frontMatter.description,
        isUpdate: !isNew,
        branch: sessionBranch,
        sha: sessionSha || currentFileSha,
        prNumber,
        images,
      });

      setSessionBranch(result.branch);
      setSessionSha(result.sha);
      setCurrentFile(filename);
      setFrontMatter((prev) => ({ ...prev, slug }));
      setSavedKey(snapshotKey(saved));
      images.forEach((img) => savedImagesRef.current.add(img.path));
      setPendingImages((prev) => prev.filter((img) => !images.includes(img)));

      // The backup moves from the shared "new" slot to this note's own slot,
      // so it can't resurface in the next new note.
      if (isNew) {
        clearBackup('note-draft:new');
        setDraftKey(`note-draft:${filename}`);
      } else {
        clearBackup();
      }
      setRestored(null);

      if (result.createdPr && result.pullRequest) {
        setPrNumber(result.pullRequest.number);
        setPrUrl(result.pullRequest.url);
        showSuccess(`Saved — opened PR #${result.pullRequest.number}. Merge it to publish.`);
      } else {
        showSuccess(`Updated PR #${prNumber}.`);
      }
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setIsPublishing(false);
    }
  };

  // Put image markdown on its own line(s) at `at` (or the cursor) and select
  // the first image's alt text so typing replaces it.
  const insertImageMarkdown = (text: string, at?: number) => {
    const view = editorViewRef.current;
    if (!view || !view.dom.isConnected) {
      setMarkdownContent((prev) => `${prev.trimEnd()}\n\n${text}\n`);
      return;
    }
    const pos = Math.min(at ?? view.state.selection.main.head, view.state.doc.length);
    const line = view.state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from).trim() ? '\n\n' : '';
    const after = line.text.slice(pos - line.from).trim() ? '\n\n' : '';
    const altStart = pos + before.length + 2; // after `![`
    view.dispatch({
      changes: { from: pos, insert: `${before}${text}${after}` },
      selection: { anchor: altStart, head: altStart + IMAGE_ALT_PLACEHOLDER.length },
    });
    view.focus();
  };

  // Resize/compress images in the browser and stage them for the next save.
  // Used by the Image button, paste, and drag-and-drop.
  const addImageFiles = async (files: File[], at?: number) => {
    if (!files.length) return;
    setUploadMessage(null);
    setIsUploadingImage(true);

    imageFolderRef.current ??=
      currentFile?.replace(/\.md$/, '') ||
      slugifyStr(frontMatter.slug || frontMatter.title) ||
      `note-${Date.now().toString(36)}`;
    const folder = imageFolderRef.current;

    const lines: string[] = [];
    try {
      for (const [i, file] of files.entries()) {
        const validation = validateImage(file);
        if (!validation.valid) throw new Error(validation.error || 'Invalid image');
        const optimized = await optimizeImage(file);
        if (optimized.size > MAX_FILE_SIZE) {
          throw new Error(`${file.name} is still over ${MAX_FILE_SIZE / 1024 / 1024}MB after resizing. Try a smaller image.`);
        }
        const base = slugifyStr(optimized.name.replace(/\.[^.]+$/, '')) || 'image';
        const ext = optimized.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filename = `${base}-${Date.now().toString(36)}${i}.${ext}`;
        const path = `/notes-images/${folder}/${filename}`;
        previewUrlsRef.current.set(path, URL.createObjectURL(optimized));
        setPendingImages((prev) => [...prev, { file: optimized, path, folder, filename }]);
        lines.push(`![${IMAGE_ALT_PLACEHOLDER}](${path})`);
      }
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message || 'Failed to process image' });
    } finally {
      setIsUploadingImage(false);
    }

    if (lines.length) {
      insertImageMarkdown(lines.join('\n\n'), at);
      setUploadMessage((prev) =>
        prev?.type === 'error'
          ? prev
          : { type: 'success', text: 'Type a short description over the highlighted text. Images upload when you save.' },
      );
      window.setTimeout(() => setUploadMessage((prev) => (prev?.type === 'success' ? null : prev)), 8000);
    }
  };
  addImageFilesRef.current = addImageFiles;

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    addImageFiles(files);
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
        title="Add image (you can also paste or drop one into the editor)"
        className="rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
      >
        {isUploadingImage ? 'Adding…' : 'Image'}
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Same bent arrow as the navbar's back button. */}
        <button onClick={goBack} className="btn-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20.25 5.25A9 9 0 0 1 11.25 14.25H3.75M8.25 9.75L3.75 14.25L8.25 18.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All notes
        </button>
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
      {restored && (
        <p className="text-sm text-muted-foreground">
          Picked up your unsaved changes from {formatSavedAt(restored.savedAt)}.{' '}
          <button onClick={revertToSaved} className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground hover:decoration-foreground">
            {currentFile ? 'Revert to saved version' : 'Start over'}
          </button>
        </p>
      )}
      {confirmingLeave && (
        <div className="status-warning flex flex-wrap items-center justify-between gap-3">
          <span>Leave without saving? Your changes will be discarded.</span>
          <span className="flex gap-4">
            <button onClick={() => discardAndLeave('/admin')} className="font-medium hover:opacity-80">Discard and leave</button>
            <button onClick={() => setConfirmingLeave(false)} className="hover:opacity-80">Keep editing</button>
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
              {currentFile ? (
                <>
                  {/* The filename is the URL, fixed at the first save. */}
                  <input type="text" value={currentFile.replace(/\.md$/, '')} disabled className="field-input opacity-60" />
                  <p className="mt-1 text-xs text-muted-foreground">Set when the note was first saved.</p>
                </>
              ) : (
                <input type="text" value={frontMatter.slug} onChange={(e) => handleFrontMatterChange('slug', e.target.value)} className="field-input" placeholder="post-slug" />
              )}
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
        multiple
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
        {/* While the floating bar shows, this stays in the layout (invisible) so
            the text doesn't jump up, and the floating bar sits in its space. */}
        {tab === 'write' && (
          <div className={`flex flex-wrap items-center gap-0.5 ${barFloating ? 'invisible' : ''}`} aria-hidden={barFloating || undefined}>
            {formatToolbarButtons}
          </div>
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
