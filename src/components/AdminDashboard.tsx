import React, { useState, useEffect } from 'react';
import BranchSelector from './BranchSelector';

interface BlogPost {
  filename: string;
  title: string;
  slug: string;
  pubDate: string;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('master');

  // Check if already authenticated
  useEffect(() => {
    const authenticated = localStorage.getItem('admin-authenticated');
    if (authenticated === 'true') {
      setIsAuthenticated(true);
      loadBlogPosts();
    }
  }, []);

  // Reload posts when branch changes
  useEffect(() => {
    if (isAuthenticated) {
      loadBlogPosts();
    }
  }, [selectedBranch]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('admin-authenticated', 'true');
        loadBlogPosts();
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (err) {
      setError('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin-authenticated');
    setPassword('');
    setBlogPosts([]);
  };

  const loadBlogPosts = async () => {
    setLoadingPosts(true);
    setError('');
    
    try {
      const response = await fetch(`/api/github/files?branch=${encodeURIComponent(selectedBranch)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load blog posts');
      }

      const posts: BlogPost[] = data.files.map((file: any) => ({
        filename: file.name,
        title: file.name.replace('.md', '').replace(/-/g, ' '),
        slug: file.name.replace('.md', ''),
        pubDate: file.pubDate || new Date().toISOString().split('T')[0],
      }));
      
      // Sort posts by creation date descending (most recent first)
      posts.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      
      setBlogPosts(posts);
    } catch (err: any) {
      setError(err.message || 'Failed to load blog posts');
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleBranchSelect = (branch: string) => {
    setSelectedBranch(branch);
  };

  const handleEditPost = (filename: string) => {
    window.location.href = `/admin/edit?file=${encodeURIComponent(filename)}&branch=${encodeURIComponent(selectedBranch)}`;
  };

  const handleCreateNew = () => {
    window.location.href = `/admin/edit?branch=${encodeURIComponent(selectedBranch)}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto bg-surface border border-muted rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
          Admin Access
        </h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-muted rounded-md text-foreground placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Enter admin password"
              required
            />
          </div>
          
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-white py-3 px-4 rounded-md hover:opacity-80 disabled:opacity-50 transition-opacity font-medium"
          >
            {isLoading ? 'Authenticating...' : 'Access Admin'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
          <h2>
            Manage Blog Posts
          </h2>
      <div className="flex items-center">
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-tertiary hover:text-foreground transition-colors"
        >
          Logout
        </button>
        <button
          onClick={handleCreateNew}
          className="bg-primary text-white px-4 py-2 rounded-md hover:opacity-80 transition-opacity font-medium"
        >
          New Post
        </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
          <button 
            onClick={() => setError('')}
            className="ml-2 text-red-800 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {/* Branch Selector */}
      <BranchSelector
        selectedBranch={selectedBranch}
        onBranchSelect={handleBranchSelect}
      />

      {/* Existing Posts */}
      <div className="bg-surface border border-muted rounded-lg overflow-hidden">
        <div className="bg-secondary px-3 py-2 border-b border-muted">
          <h3>Existing Posts</h3>
        </div>

        {loadingPosts ? (
          <div className="text-center py-6 text-tertiary">
            Loading posts...
          </div>
        ) : blogPosts.length === 0 ? (
          <div className="text-center py-6 text-tertiary">
            No blog posts found. Create your first post!
          </div>
        ) : (
          <div className="divide-y divide-muted">
            {blogPosts.map((post) => (
              <div 
                key={post.filename}
                className="p-3 hover:bg-background transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-md font-semibold text-foreground mb-1">
                      {post.title}
                    </div>
                    <div className="text-sm text-tertiary">
                      <span>Published: {post.pubDate}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEditPost(post.filename)}
                    className="bg-secondary text-foreground px-4 py-2 rounded-md hover:bg-muted transition-colors font-medium"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}