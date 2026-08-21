import { useState, useEffect, useRef } from 'react';

// Local draft safety: a debounced localStorage autosave plus a synchronous
// flush before the page goes away, so a tab close/crash never loses work.
// The storage shape and `note-draft:` keys are unchanged from the original
// inline implementation, so existing saved drafts still restore.
//
// `snapshot` must be referentially stable across unrelated re-renders (the
// caller memoizes it) so the debounce timer only resets on actual edits.
export function useDraftSafety<T>({
  draftKey,
  snapshot,
  hasUnsavedChanges,
  onRestore,
}: {
  draftKey: string;
  snapshot: T;
  hasUnsavedChanges: boolean;
  onRestore: (draft: T) => void;
}) {
  const [pendingDraft, setPendingDraft] = useState<T | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current snapshot so the unload flush persists the latest edit
  // (the debounced autosave can otherwise lose the last <800ms of typing).
  const latestDraftRef = useRef({ snapshot, draftKey, hasUnsavedChanges });
  latestDraftRef.current = { snapshot, draftKey, hasUnsavedChanges };

  // Surface a previously saved draft (if any) once the key is known.
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setPendingDraft(JSON.parse(saved));
    } catch {
      // corrupt draft — ignore
    }
  }, [draftKey]);

  // Debounced local autosave so a tab close/crash never loses work.
  useEffect(() => {
    if (!draftKey || !hasUnsavedChanges) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(snapshot));
      } catch {
        // storage unavailable — best effort
      }
    }, 800);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [snapshot, hasUnsavedChanges, draftKey]);

  // Flush the current draft synchronously before the page goes away, and warn
  // on unsaved changes. Reads from the ref so it always sees the latest edit;
  // `pagehide` covers mobile Safari, which often skips `beforeunload`.
  useEffect(() => {
    const flush = () => {
      const { snapshot: snap, draftKey: key, hasUnsavedChanges: dirty } = latestDraftRef.current;
      if (dirty && key) {
        try {
          localStorage.setItem(key, JSON.stringify(snap));
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
    if (pendingDraft) onRestore(pendingDraft);
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

  /** Drop the saved draft (after a successful publish). */
  const clearDraft = () => {
    try {
      if (draftKey) localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  };

  return { pendingDraft, restoreDraft, discardDraft, clearDraft };
}
