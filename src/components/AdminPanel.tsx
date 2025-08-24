import React, { useState, useEffect } from 'react';
import MarkdownEditor from './MarkdownEditor';
import FileSelector from './FileSelector';
import BranchSelector from './BranchSelector';

interface AdminPanelProps {}

export default function AdminPanel({}: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // CMS state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentFrontMatter, setCurrentFrontMatter] = useState<any>(null);

  // Check if already authenticated from localStorage
  useEffect(() => {
    const authenticated = localStorage.getItem('admin-authenticated');
    if (authenticated === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // For now, we'll use a simple client-side check
      // In production, this should be verified server-side
      const adminPassword = import.meta.env.PUBLIC_ADMIN_PASSWORD || 'admin123';
      
      if (password === adminPassword) {
        setIsAuthenticated(true);
        localStorage.setItem('admin-authenticated', 'true');
      } else {
        setError('Invalid password');
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
  };

  const handleFileSelect = (filename: string | null) => {
    if (hasUnsavedChanges) {
      const confirmSwitch = confirm('You have unsaved changes. Are you sure you want to switch files?');
      if (!confirmSwitch) return;
    }
    
    setSelectedFile(filename);
    setHasUnsavedChanges(false);
  };

  const handleContentLoad = (content: string) => {
    setEditorContent(content);
    setHasUnsavedChanges(false);
  };

  const handleContentChange = (content: string, frontMatter: any) => {
    setEditorContent(content);
    setCurrentFrontMatter(frontMatter);
    setHasUnsavedChanges(true);
  };

  const handleBranchSelect = (branch: string) => {
    setSelectedBranch(branch);
  };

  const handleSave = async () => {
    if (!selectedBranch) {
      setError('Please select a branch before saving');
      return;
    }

    if (!editorContent.trim()) {
      setError('Cannot save empty content');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Determine filename
      const filename = selectedFile || `${currentFrontMatter?.slug || 'new-post'}.md`;
      
      // Create commit message
      const commitMessage = selectedFile 
        ? `Update ${filename} via CMS`
        : `Create ${filename} via CMS`;

      // Commit the file
      const response = await fetch('/api/github/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editorContent,
          filename: filename,
          message: commitMessage,
          branch: selectedBranch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save file');
      }

      // Update state
      setSelectedFile(filename);
      setHasUnsavedChanges(false);
      
      // Show success message temporarily
      const successMsg = `Saved ${filename} to ${selectedBranch}`;
      console.log(successMsg);

    } catch (err: any) {
      setError(err.message || 'Failed to save file');
      console.error('Error saving file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePR = async () => {
    if (!selectedBranch || selectedBranch === 'master') {
      setError('Please select a feature branch to create a PR');
      return;
    }

    if (hasUnsavedChanges) {
      setError('Please save your changes before creating a PR');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const title = currentFrontMatter?.title 
        ? `Add/Update: ${currentFrontMatter.title}`
        : `Update blog post`;

      const body = `## Changes

${selectedFile ? 'Updated' : 'Created'} blog post: ${selectedFile || 'new post'}

### Summary
${currentFrontMatter?.description || 'Blog post updates via CMS'}

---
*Created via blog CMS*`;

      const response = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          head: selectedBranch,
          base: 'master',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create PR');
      }

      // Show success and optionally open PR
      console.log('PR created:', data.pullRequest);
      if (data.pullRequest.url) {
        window.open(data.pullRequest.url, '_blank');
      }

    } catch (err: any) {
      setError(err.message || 'Failed to create PR');
      console.error('Error creating PR:', err);
    } finally {
      setIsSaving(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Content Management
          </h2>
          <div className="text-sm text-tertiary mt-1 space-y-1">
            {selectedFile && (
              <div>
                Editing: {selectedFile}
                {hasUnsavedChanges && <span className="text-orange-500 ml-2">• Unsaved changes</span>}
              </div>
            )}
            {selectedBranch && (
              <div>Branch: {selectedBranch}</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasUnsavedChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary text-white px-4 py-2 rounded-md hover:opacity-80 disabled:opacity-50 transition-opacity font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          {!hasUnsavedChanges && selectedBranch && selectedBranch !== 'master' && (
            <button
              onClick={handleCreatePR}
              disabled={isSaving}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:opacity-80 disabled:opacity-50 transition-opacity font-medium"
            >
              {isSaving ? 'Creating PR...' : 'Create PR'}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-tertiary hover:text-foreground transition-colors"
          >
            Logout
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <FileSelector
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onLoadContent={handleContentLoad}
          />
          
          <BranchSelector
            selectedBranch={selectedBranch}
            onBranchSelect={handleBranchSelect}
          />
        </div>

        {/* Main Editor Area */}
        <div className="lg:col-span-3">
          <MarkdownEditor
            key={selectedFile || 'new'} // Force re-render when file changes
            initialContent={editorContent}
            onContentChange={handleContentChange}
          />
        </div>
      </div>
    </div>
  );
}