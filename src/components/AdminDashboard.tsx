import React, { useState, useEffect } from 'react';
import * as api from '@/lib/cms-api';
import { ApiError, type PendingPR } from '@/lib/cms-api';

interface Note {
  filename: string;
  title: string;
  slug: string;
  pubDate: string;
  sha: string;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [pending, setPending] = useState<PendingPR[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const showSuccess = (text: string) => {
    setSuccessMessage(text);
    window.setTimeout(() => setSuccessMessage(''), 6000);
  };

  // Confirm the session with the server on load.
  useEffect(() => {
    (async () => {
      try {
        const data = await api.checkSession();
        if (data.authenticated) {
          setIsAuthenticated(true);
          loadNotes();
        }
      } catch {
        // Network error — leave the login form up.
      }
    })();
  }, []);

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.login(password);
      setIsAuthenticated(true);
      loadNotes();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout().catch(() => {});
    setIsAuthenticated(false);
    setPassword('');
    setNotes([]);
    setPending([]);
  };

  const loadNotes = async () => {
    setLoadingNotes(true);
    setError('');
    try {
      const data = await api.listNotes();
      const posts: Note[] = data.files.map((file) => ({
        filename: file.name,
        title: file.title || file.name.replace('.md', '').replace(/-/g, ' '),
        slug: file.name.replace('.md', ''),
        pubDate: file.pubDate || '',
        sha: file.sha,
      }));
      posts.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
      setNotes(posts);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        setIsAuthenticated(false);
        setLoadingNotes(false);
        return;
      }
      setError(err.message || 'Failed to load notes');
    } finally {
      setLoadingNotes(false);
    }

    // Surface published-but-unmerged notes so they can be reopened and re-edited.
    // Best-effort: a failure here shouldn't block the main list.
    try {
      const data = await api.pending();
      setPending(data.pending || []);
    } catch {
      // ignore — the "In review" section just won't show
    }
  };

  // A pending PR reopens in the editor pointed at its branch so re-publishing
  // updates the same PR instead of opening a new one.
  const handleEditPending = (pr: PendingPR) => {
    if (!pr.filename) return;
    const params = new URLSearchParams({
      file: pr.filename,
      branch: pr.branch,
      pr: String(pr.number),
    });
    window.location.href = `/admin/edit?${params.toString()}`;
  };

  const handleEditNote = (filename: string) => {
    window.location.href = `/admin/edit?file=${encodeURIComponent(filename)}`;
  };

  const handleCreateNew = () => {
    window.location.href = '/admin/edit';
  };

  // Deletion follows the same one-click-PR flow as publishing: auto-branch off
  // master, remove the file, open a PR. Master is untouched until it's merged,
  // so the note stays in the list until then.
  const handleDelete = async (note: Note) => {
    setDeletingFile(note.filename);
    setError('');
    try {
      const pr = await api.deleteNotePipeline({
        filename: note.filename,
        sha: note.sha,
        slug: note.slug,
        title: note.title,
      });

      setConfirmingDelete(null);
      showSuccess(`Opened PR #${pr.number} to delete "${note.title}". Merge it to remove the note.`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete note');
    } finally {
      setDeletingFile(null);
    }
  };

  // Login — a quiet, vertically-centered form. No card, in keeping with the
  // rest of the site; presence comes from centering and spacing.
  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-xs space-y-8">
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-medium tracking-tight text-foreground">Admin</h1>
            <p className="text-sm text-muted-foreground">Sign in to manage your notes.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="Password"
              autoFocus
              required
            />
            {error && <p className="text-sm text-danger text-center">{error}</p>}
            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between gap-6">
        <h1 className="text-2xl font-medium leading-[1.3] tracking-tight text-foreground">Notes</h1>
        <div className="flex items-center gap-5 text-sm shrink-0">
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground transition-colors">
            Log out
          </button>
          <button onClick={handleCreateNew} className="text-muted-foreground hover:text-foreground transition-colors">
            New note →
          </button>
        </div>
      </div>

      {successMessage && <p className="status-success">{successMessage}</p>}
      {error && <p className="status-error">{error}</p>}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">In review</h2>
          <div className="divide-y divide-muted">
            {pending.map((pr) => (
              <div key={pr.number} className="group flex items-center justify-between gap-6 py-3.5">
                {pr.filename && !pr.isDelete ? (
                  <button onClick={() => handleEditPending(pr)} className="min-w-0 text-left">
                    <span className="block truncate text-base font-medium text-foreground leading-snug hover:underline decoration-1">
                      {pr.title}
                    </span>
                  </button>
                ) : (
                  <span className="min-w-0 truncate text-base font-medium text-foreground leading-snug">
                    {pr.isDelete ? '🗑 ' : ''}{pr.title}
                  </span>
                )}
                <div className="flex items-center gap-4 shrink-0 text-sm">
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-link transition-colors"
                  >
                    PR #{pr.number}
                  </a>
                  {/* Invisible placeholder matching the Published rows' hover-only
                      Delete button, so PR #n aligns to the date column. */}
                  <span aria-hidden="true" className="invisible">Delete</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loadingNotes ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No notes yet. Create your first one.</p>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Published</h2>
          <div className="divide-y divide-muted">
          {notes.map((post) => (
            <div key={post.filename} className="group flex items-center justify-between gap-6 py-3.5">
              <button
                onClick={() => handleEditNote(post.filename)}
                className="min-w-0 text-left"
              >
                <span className="block truncate text-base font-medium text-foreground leading-snug group-hover:underline decoration-1">
                  {post.title}
                </span>
              </button>

              <div className="flex items-center gap-4 shrink-0">
                {post.pubDate && (
                  <time className="text-sm text-muted-foreground tabular-nums">{post.pubDate}</time>
                )}
                {confirmingDelete === post.filename ? (
                  <span className="text-sm">
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={deletingFile === post.filename}
                      className="text-danger font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
                    >
                      {deletingFile === post.filename ? 'Deleting…' : 'Delete'}
                    </button>
                    <span className="text-muted-foreground"> · </span>
                    <button
                      onClick={() => setConfirmingDelete(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(post.filename)}
                    className="text-sm text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger transition-all"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          </div>
        </section>
      )}
    </div>
  );
}
