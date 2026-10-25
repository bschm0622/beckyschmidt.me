import { useEffect, useRef } from 'react';

export function useDraftSafety<T>({
  draftKey,
  snapshot,
  dirty,
}: {
  draftKey: string;
  snapshot: T;
  dirty: boolean;
}) {
  const latestRef = useRef({ snapshot, draftKey, dirty });
  latestRef.current = { snapshot, draftKey, dirty };
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      if (leavingRef.current) return;
      try {
        if (dirty) localStorage.setItem(draftKey, JSON.stringify({ snapshot, savedAt: Date.now() }));
        else localStorage.removeItem(draftKey);
      } catch {
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [snapshot, dirty, draftKey]);

  // `pagehide` covers mobile Safari, which often skips `beforeunload`.
  useEffect(() => {
    const flush = () => {
      const { snapshot: snap, draftKey: key, dirty: isDirty } = latestRef.current;
      if (leavingRef.current || !isDirty || !key) return;
      try {
        localStorage.setItem(key, JSON.stringify({ snapshot: snap, savedAt: Date.now() }));
      } catch {
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
      return null;
    }
  };

  const clearBackup = (key = draftKey) => {
    try {
      if (key) localStorage.removeItem(key);
    } catch {
    }
  };

  const discardAndLeave = (href: string) => {
    leavingRef.current = true;
    clearBackup();
    window.location.href = href;
  };

  return { readBackup, clearBackup, discardAndLeave };
}
