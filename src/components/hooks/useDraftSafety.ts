import { useEffect, useRef } from 'react';

// Local draft backup: a debounced localStorage copy of unsaved edits plus a
// synchronous flush before the page goes away, so a tab close/crash never
// loses work. There's no prompt on the way back in: the editor reads the
// backup with `readBackup()` after loading a note and, if it differs from
// what's saved, loads it and offers a quiet "Revert".
//
// Backups live under `note-draft:<filename>` (or `note-draft:new` until a new
// note's first save). Older backups stored the snapshot directly; newer ones
// wrap it as `{ snapshot, savedAt }`. `readBackup` accepts both.
//
// `snapshot` must be referentially stable across unrelated re-renders (the
// caller memoizes it) so the debounce timer only resets on actual edits.
export function useDraftSafety<T>({
  draftKey,
  snapshot,
  dirty,
}: {
  draftKey: string;
  snapshot: T;
  dirty: boolean;
}) {
  // Always-current values so the unload flush persists the latest edit (the
  // debounced autosave can otherwise lose the last <800ms of typing).
  const latestRef = useRef({ snapshot, draftKey, dirty });
  latestRef.current = { snapshot, draftKey, dirty };
  // Set when the writer chose to leave without saving: skip the flush and the
  // browser's own "Leave site?" prompt (the editor already asked).
  const leavingRef = useRef(false);

  // Debounced autosave while dirty; once edits match what's saved again, the
  // backup is dropped so it can't resurface later.
  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      if (leavingRef.current) return;
      try {
        if (dirty) localStorage.setItem(draftKey, JSON.stringify({ snapshot, savedAt: Date.now() }));
        else localStorage.removeItem(draftKey);
      } catch {
        // storage unavailable — best effort
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [snapshot, dirty, draftKey]);

  // Flush synchronously before the page goes away, and warn on unsaved
  // changes. `pagehide` covers mobile Safari, which often skips `beforeunload`.
  useEffect(() => {
    const flush = () => {
      const { snapshot: snap, draftKey: key, dirty: isDirty } = latestRef.current;
      if (leavingRef.current || !isDirty || !key) return;
      try {
        localStorage.setItem(key, JSON.stringify({ snapshot: snap, savedAt: Date.now() }));
      } catch {
        // best effort
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      if (!leavingRef.current && latestRef.current.dirty) {
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

  /** The saved backup for `key`, if any. */
  const readBackup = (key: string): { snapshot: T; savedAt: number | null } | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'snapshot' in parsed) {
        return { snapshot: parsed.snapshot as T, savedAt: parsed.savedAt ?? null };
      }
      return { snapshot: parsed as T, savedAt: null };
    } catch {
      return null; // corrupt backup — ignore
    }
  };

  /** Drop the backup for `key` (defaults to the current key). */
  const clearBackup = (key = draftKey) => {
    try {
      if (key) localStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  /** Leave without saving: drop the backup and skip the browser's prompt. */
  const discardAndLeave = (href: string) => {
    leavingRef.current = true;
    clearBackup();
    window.location.href = href;
  };

  return { readBackup, clearBackup, discardAndLeave };
}
