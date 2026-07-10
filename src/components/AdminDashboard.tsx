import React, { useState, useEffect } from 'react';

interface Note {
  filename: string;
  title: string;
  slug: string;
  pubDate: string;
  sha: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const showSuccess = (text: string) => {
    setSuccessMessage(text);
    window.setTimeout(() => setSuccessMessage(''), 6000);
  };

  // Confirm the session with the server on load rather than trusting a stale
  // localStorage flag.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          localStorage.setItem('admin-authenticated', 'true');
          loadNotes();
        } else {
          localStorage.removeItem('admin-authenticated');
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
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('admin-authenticated', 'true');
        loadNotes();
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch {
      setError('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
    setIsAuthenticated(false);
    localStorage.removeItem('admin-authenticated');
    setPassword('');
    setNotes([]);
  };

  const loadNotes = async () => {
    setLoadingNotes(true);
    setError('');
    try {
      const response = await fetch('/api/github/files?branch=master');
      if (response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('admin-authenticated');
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load notes');

      const posts: Note[] = data.files.map((file: any) => ({
        filename: file.name,
        title: file.title || file.name.replace('.md', '').replace(/-/g, ' '),
        slug: file.name.replace('.md', ''),
        pubDate: file.pubDate || '',
        sha: file.sha,
      }));
      posts.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
      setNotes(posts);
    } catch (err: any) {
      setError(err.message || 'Failed to load notes');
    } finally {
      setLoadingNotes(false);
    }
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
      const branch = `cms/delete-${note.slug}-${Date.now().toString(36)}`;

      const br = await fetch('/api/github/create-branch', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ branchName: branch, fromBranch: 'master' }),
      });
      if (!br.ok && br.status !== 409) {
        throw new Error((await br.json()).error || 'Failed to create branch');
      }

      const dr = await fetch('/api/github/delete', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          filename: note.filename,
          sha: note.sha,
          branch,
          message: `Delete ${note.filename} via CMS`,
        }),
      });
      const dd = await dr.json();
      if (!dr.ok) throw new Error(dd.error || 'Failed to delete note');

      const pr = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          title: `Delete: ${note.title}`,
          body: 'Note deletion via CMS',
          head: branch,
          base: 'master',
        }),
      });
      const pd = await pr.json();
      if (!pr.ok) throw new Error(pd.error || 'Failed to open PR');

      setConfirmingDelete(null);
      showSuccess(`Opened PR #${pd.pullRequest.number} to delete "${note.title}". Merge it to remove the note.`);
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
              className="field-input text-center"
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

      {loadingNotes ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No notes yet. Create your first one.</p>
      ) : (
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
      )}
    </div>
  );
}
