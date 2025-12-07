import React, { useState, useEffect, useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import type { EditorView as EditorViewType } from '@codemirror/view';
import MarkdownIt from 'markdown-it';
import BranchSelector from './BranchSelector';
import { validateImage, optimizeImage } from '../utils/imageProcessor';

interface FrontMatter {
  title: string;
  slug: string;
  pubDate: string;
  description: string;
  author: string;
  tags: string;
}

export default function BlogEditor() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Editor state
  const [frontMatter, setFrontMatter] = useState<FrontMatter>({
    title: '',
    slug: '',
    pubDate: new Date().toISOString().split('T')[0],
    description: '',
    author: 'Becky Schmidt',
    tags: ''
  });
  
  const [markdownContent, setMarkdownContent] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [sourceBranch, setSourceBranch] = useState('master'); // Branch we loaded the file from
  const [targetBranch, setTargetBranch] = useState(''); // Branch we want to save to
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentFileSha, setCurrentFileSha] = useState<string | null>(null);
  const [prStatus, setPrStatus] = useState<{
    hasPR: boolean;
    pullRequest?: {
      number: number;
      url: string;
      title: string;
      state: string;
    };
  } | null>(null);

  // Image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorViewRef = useRef<EditorViewType | null>(null);
  const [pendingImages, setPendingImages] = useState<Array<{
    file: File;
    placeholder: string;
    filename: string;
  }>>([]);
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light');

  const mdParser = new MarkdownIt();

  // Configure markdown-it to handle missing images gracefully
  const defaultRender = mdParser.renderer.rules.image || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  mdParser.renderer.rules.image = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const srcIndex = token.attrIndex('src');
    const altIndex = token.attrIndex('alt');

    if (srcIndex >= 0) {
      const src = token.attrs![srcIndex][1];
      const alt = altIndex >= 0 ? token.attrs![altIndex][1] : 'Image';

      // Check if this is a pending image (starts with /blog-images/)
      if (src.startsWith('/blog-images/')) {
        // Return a placeholder for images that don't exist yet
        return `<div class="border border-dashed border-muted rounded p-4 text-center text-tertiary my-4">
          <svg class="inline-block w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p class="text-sm">Image: ${alt}</p>
          <p class="text-xs mt-1 opacity-75">(Will be uploaded when you save)</p>
        </div>`;
      }

      // For other images, render normally with error handling
      token.attrPush(['onerror', "this.style.display='none'"]);
      token.attrPush(['loading', 'lazy']);
    }

    return defaultRender(tokens, idx, options, env, self);
  };

  // Detect theme changes
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setEditorTheme(isDark ? 'dark' : 'light');
    };

    // Set initial theme
    updateTheme();

    // Listen for theme changes
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Check authentication and load content
  useEffect(() => {
    const authenticated = localStorage.getItem('admin-authenticated');
    if (authenticated !== 'true') {
      window.location.href = '/admin';
      return;
    }
    
    setIsAuthenticated(true);
    
    // Check if editing existing file and get branch
    const urlParams = new URLSearchParams(window.location.search);
    const filename = urlParams.get('file');
    const branchFromUrl = urlParams.get('branch');
    
    
    // Set source branch from URL if provided
    if (branchFromUrl) {
      setSourceBranch(branchFromUrl);
    }
    
    
    if (filename && filename !== 'null' && filename !== 'undefined') {
      setCurrentFile(filename);
      loadFileContent(filename, branchFromUrl || 'master');
    } else {
      console.log('No valid filename in URL, creating new post. Filename was:', filename);
      // New post template
      // New post template
      const newContent = `---
title: ""
slug: ""
pubDate: "${new Date().toISOString().split('T')[0]}"
description: ""
author: "Becky Schmidt"
tags: ""
---

<!-- Start writing your blog post content here -->
`;
      
      parseMarkdownWithFrontMatter(newContent);
    }
    
    setIsLoading(false);
  }, []);

  // Update preview when content changes
  useEffect(() => {
    updatePreview(markdownContent);
  }, [markdownContent]);

  const loadFileContent = async (filename: string, branch: string = 'master') => {
    try {
      setError(''); // Clear any previous errors
      
      if (!filename) {
        throw new Error('No filename provided to loadFileContent');
      }
      
      // Use the new individual file API endpoint with branch parameter
      const apiUrl = `/api/github/file/src/blog/${filename}?branch=${encodeURIComponent(branch)}`;
      
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to load file`);
      }

      const data = await response.json();
            
      if (!data || !data.content) {
        throw new Error('File content is empty or missing from API response');
      }

      setCurrentFileSha(data.sha);
      parseMarkdownWithFrontMatter(data.content);
      
    } catch (err: any) {
      console.error('Error loading file:', err);
      
      if (err.message.includes('GitHub token not configured')) {
        setError(`GitHub not configured. Using local file fallback for ${filename}.`);
        
        // Try to create content based on the filename
        const titleFromFilename = filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const slugFromFilename = filename.replace('.md', '');
        
        const fallbackContent = `---
title: "${titleFromFilename}"
slug: "${slugFromFilename}"
pubDate: "${new Date().toISOString().split('T')[0]}"
description: "Edit this description for ${titleFromFilename}"
author: "Becky Schmidt"
tags: "blog"
---

# ${titleFromFilename}

GitHub integration is not configured yet. You can edit this content and it will be ready when you set up the GitHub token.

## Getting Started

1. Set up your GitHub token in environment variables
2. Edit this content as needed
3. Save changes to commit to your repository

Start writing your content here...`;
        
        parseMarkdownWithFrontMatter(fallbackContent);
      } else {
        setError(`Failed to load ${filename}: ${err.message}`);
        
        // Generic fallback content
        const fallbackContent = `---
title: "New Blog Post"
slug: "new-blog-post"
pubDate: "${new Date().toISOString().split('T')[0]}"
description: "There was an error loading the original file content"
author: "Becky Schmidt"
tags: "error"
---

# Error Loading File

There was an error loading the content for ${filename}: ${err.message}

You can still edit and save new content here.`;
        
        parseMarkdownWithFrontMatter(fallbackContent);
      }
    }
  };

  const parseMarkdownWithFrontMatter = (content: string) => {
    if (!content || typeof content !== 'string') {
      console.error('Invalid content provided to parseMarkdownWithFrontMatter:', content);
      setError('Invalid file content received');
      return;
    }

    const frontMatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (match) {
      const [, frontMatterStr, contentStr] = match;

      const parsedFrontMatter = { ...frontMatter };
      
      if (frontMatterStr) {
        frontMatterStr.split('\n').forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Remove surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            if (key in parsedFrontMatter) {
              (parsedFrontMatter as any)[key] = value;
            }
          }
        });
      }

      setFrontMatter(parsedFrontMatter);
      setMarkdownContent(contentStr ? contentStr.trim() : '');
    } else {
      // No frontmatter found, treat entire content as markdown
      setMarkdownContent(content.trim());
    }
  };

  const generateFullMarkdown = () => {
    const frontMatterStr = `---
title: "${frontMatter.title}"
slug: "${frontMatter.slug}"
pubDate: "${frontMatter.pubDate}"
author: "${frontMatter.author}"
description: "${frontMatter.description}"
tags: ${frontMatter.tags}
---`;

    return `${frontMatterStr}\n${markdownContent}`;
  };

  const checkPRStatus = async (branch: string) => {
    if (!branch || branch === 'master') {
      setPrStatus(null);
      return;
    }

    try {
      const response = await fetch(`/api/github/pr-status?branch=${encodeURIComponent(branch)}`);
      if (response.ok) {
        const data = await response.json();
        setPrStatus(data);
      }
    } catch (error) {
      console.error('Failed to check PR status:', error);
      setPrStatus(null);
    }
  };

  const handleFrontMatterChange = (field: keyof FrontMatter, value: string) => {
    setFrontMatter(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdownContent(value);
    setHasUnsavedChanges(true);
  }, []);

  const updatePreview = (content: string) => {
    if (!content.trim()) {
      setPreviewHtml('<p class="text-tertiary">Preview will appear here...</p>');
      return;
    }
    setPreviewHtml(mdParser.render(content));
  };

  const isProtectedBranch = (branchName: string) => {
    return ['master', 'main'].includes(branchName);
  };

  const handleSave = async () => {
    if (!targetBranch) {
      setError('Please select a branch to save to');
      return;
    }

    if (isProtectedBranch(targetBranch)) {
      setError('Cannot commit directly to protected branches. Please select or create a feature branch.');
      return;
    }

    if (!generateFullMarkdown().trim()) {
      setError('Cannot save empty content');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // First, upload any pending images
      if (pendingImages.length > 0) {
        setError(`Uploading ${pendingImages.length} image(s)...`);

        for (const pendingImage of pendingImages) {
          const formData = new FormData();
          formData.append('file', pendingImage.file);
          formData.append('slug', frontMatter.slug);
          formData.append('branch', targetBranch);
          formData.append('filename', pendingImage.filename);
          formData.append('message', `Add image for ${frontMatter.slug}`);

          const imageResponse = await fetch('/api/github/upload-image', {
            method: 'POST',
            body: formData,
          });

          if (!imageResponse.ok) {
            const errorData = await imageResponse.json();
            throw new Error(`Failed to upload image ${pendingImage.filename}: ${errorData.error}`);
          }
        }

        // Clear pending images after successful upload
        setPendingImages([]);
        setError('Images uploaded. Saving post...');
      }

      // Use slug for new files, keep original filename for existing files
      const filename = currentFile || `${frontMatter.slug || 'new-post'}.md`;
      const commitMessage = currentFile
        ? `Update ${filename} via CMS`
        : `Create ${filename} via CMS`;

      const commitPayload: any = {
        content: generateFullMarkdown(),
        filename: filename,
        message: commitMessage,
        branch: targetBranch,
      };

      // Include SHA if updating existing file
      if (currentFile && currentFileSha) {
        commitPayload.sha = currentFileSha;
      }

      const response = await fetch('/api/github/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commitPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save file');
      }

      setCurrentFile(filename);
      setCurrentFileSha(data.content?.sha || null);
      setHasUnsavedChanges(false);

      // Check PR status after saving
      await checkPRStatus(targetBranch);

      // Show success message
      alert(`Saved ${filename} to ${targetBranch} successfully!`);
      setError('');

    } catch (err: any) {
      setError(err.message || 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle image selection (doesn't upload yet, just stages the image)
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous messages
    setUploadMessage(null);

    // Validate image
    const validation = validateImage(file);
    if (!validation.valid) {
      setUploadMessage({ type: 'error', text: validation.error || 'Invalid image' });
      return;
    }

    // Check if we have a slug
    const slug = frontMatter.slug || 'untitled';
    if (!slug || slug === 'untitled') {
      setUploadMessage({ type: 'error', text: 'Please set a post slug before adding images' });
      return;
    }

    setIsUploadingImage(true);
    setUploadMessage({ type: 'success', text: 'Processing image...' });

    try {
      // Optimize image
      const optimizedFile = await optimizeImage(file);

      // Generate filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
      const filename = `${slug}-${timestamp}-${sanitizedName}`;
      const imagePath = `/blog-images/${slug}/${filename}`;

      // Add to pending images
      setPendingImages(prev => [...prev, {
        file: optimizedFile,
        placeholder: imagePath,
        filename: filename
      }]);

      // Insert markdown at cursor position
      const altText = file.name.split('.')[0];
      const imageMarkdown = `![${altText}](${imagePath})`;

      // Get cursor position and insert
      if (editorViewRef.current) {
        const view = editorViewRef.current;
        const cursorPos = view.state.selection.main.head;

        view.dispatch({
          changes: {
            from: cursorPos,
            insert: imageMarkdown
          },
          selection: { anchor: cursorPos + imageMarkdown.length }
        });
      } else {
        // Fallback: append to end of markdown content
        setMarkdownContent(prev => prev + '\n' + imageMarkdown + '\n');
      }

      setUploadMessage({
        type: 'success',
        text: `Image added! It will be uploaded when you save the post. (${pendingImages.length + 1} pending)`
      });

      setHasUnsavedChanges(true);

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Clear success message after 5 seconds
      setTimeout(() => {
        setUploadMessage(null);
      }, 5000);

    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Failed to process image'
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCreatePR = async () => {
    if (!targetBranch || targetBranch === 'master') {
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
      const title = frontMatter.title 
        ? `Add/Update: ${frontMatter.title}`
        : `Update blog post`;

      const body = `## Changes

${currentFile ? 'Updated' : 'Created'} blog post: ${currentFile || 'new post'}

### Summary
${frontMatter.description || 'Blog post updates via CMS'}

---
*Created via blog CMS*`;

      const response = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          head: targetBranch,
          base: 'master',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create PR');
      }

      // Update PR status
      setPrStatus({
        hasPR: true,
        pullRequest: data.pullRequest
      });
      
      // Show success and open PR
      alert(`PR #${data.pullRequest.number} created successfully!`);
      if (data.pullRequest.url) {
        window.open(data.pullRequest.url, '_blank');
      }

    } catch (err: any) {
      setError(err.message || 'Failed to create PR');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToDashboard = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmLeave) return;
    }
    window.location.href = '/admin';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="text-lg text-foreground mb-2">Loading editor...</div>
          <div className="text-tertiary">Please wait</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={handleBackToDashboard}
              className="text-primary hover:text-opacity-80 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
          <h1 className="text-2xl">
            {currentFile ? `Editing: ${currentFile}` : 'New Blog Post'}
          </h1>
          <div className="text-md text-tertiary space-y-1">
            <div>Source: <span className="font-medium">{sourceBranch}</span></div>
            {hasUnsavedChanges && (
              <p className="text-orange-500">• Unsaved changes</p>
            )}
            {prStatus?.hasPR && (
              <p className="text-blue-600">• PR #{prStatus.pullRequest?.number} exists for {targetBranch}</p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges || !targetBranch || isProtectedBranch(targetBranch)}
            className="bg-primary text-white px-6 py-2 rounded-md hover:opacity-80 disabled:opacity-50 transition-opacity font-medium"
            title={isProtectedBranch(targetBranch) ? 'Cannot save to protected branch' : ''}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          {!hasUnsavedChanges && targetBranch && targetBranch !== 'master' && (
            <div className="flex items-center gap-2">
              {prStatus?.hasPR ? (
                <a
                  href={prStatus.pullRequest?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:opacity-80 transition-opacity font-medium inline-flex items-center gap-2"
                >
                  View PR #{prStatus.pullRequest?.number}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <button
                  onClick={handleCreatePR}
                  disabled={isSaving}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:opacity-80 disabled:opacity-50 transition-opacity font-medium"
                >
                  {isSaving ? 'Creating PR...' : 'Create PR'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-800 hover:text-red-600">×</button>
        </div>
      )}

      {/* Branch Selector */}
      <BranchSelector
        selectedBranch={targetBranch}
        onBranchSelect={(branch) => {
          setTargetBranch(branch);
          checkPRStatus(branch);
        }}
      />

      {/* Front Matter Editor */}
      <div className="bg-surface border border-muted rounded-lg p-6">
        <h3 className="mb-4 text-lg">Post Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Title</label>
            <input
              type="text"
              value={frontMatter.title}
              onChange={(e) => handleFrontMatterChange('title', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-muted rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Post title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Slug</label>
            <input
              type="text"
              value={frontMatter.slug}
              onChange={(e) => handleFrontMatterChange('slug', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-muted rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="post-slug"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Date</label>
            <input
              type="date"
              value={frontMatter.pubDate}
              onChange={(e) => handleFrontMatterChange('pubDate', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-muted rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Tags</label>
            <input
              type="text"
              value={frontMatter.tags}
              onChange={(e) => handleFrontMatterChange('tags', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-muted rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder='["tag1","tag2","tag3"]'
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-2">Description</label>
            <textarea
              value={frontMatter.description}
              onChange={(e) => handleFrontMatterChange('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-muted rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-vertical"
              placeholder="Brief description of the post"
            />
          </div>
            </div>
          </div>

      {/* Mobile Tab Switcher */}
      <div className="md:hidden">
        <div className="flex border border-muted rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'editor'
                ? 'bg-primary text-white'
                : 'bg-surface text-tertiary hover:text-foreground'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'preview'
                ? 'bg-primary text-white'
                : 'bg-surface text-tertiary hover:text-foreground'
            }`}
          >
            Preview
          </button>
            </div>
          </div>

          {/* Editor and Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Editor */}
            <div className={`${activeTab !== 'editor' ? 'hidden md:block' : ''}`}>
          <div className="bg-surface border border-muted rounded-lg overflow-hidden">
            <div className="bg-secondary px-4 py-2 border-b border-muted flex items-center justify-between">
              <h4 className="font-medium text-foreground">Markdown Editor</h4>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage || !frontMatter.slug}
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={!frontMatter.slug ? "Set a post slug first" : "Add image (will upload when you save)"}
                >
                  {isUploadingImage ? 'Processing...' : `📷 Add Image${pendingImages.length > 0 ? ` (${pendingImages.length})` : ''}`}
                </button>
              </div>
            </div>
            {uploadMessage && (
              <div className={`px-4 py-2 text-sm border-b ${
                uploadMessage.type === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                {uploadMessage.text}
              </div>
            )}
            <div className="min-h-96 max-h-[32rem] overflow-auto">
              <CodeMirror
                value={markdownContent}
                onChange={handleMarkdownChange}
                extensions={[markdown(), EditorView.lineWrapping]}
                theme={editorTheme}
                onCreateEditor={(view) => {
                  editorViewRef.current = view;
                }}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  dropCursor: false,
                  allowMultipleSelections: false,
                  indentOnInput: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  highlightSelectionMatches: false,
                }}
                style={{
                  fontSize: '14px',
                  minHeight: '384px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className={`${activeTab !== 'preview' ? 'hidden md:block' : ''}`}>
          <div className="bg-surface border border-muted rounded-lg overflow-hidden">
            <div className="bg-secondary px-4 py-2 border-b border-muted">
              <h4 className="font-medium text-foreground">Preview</h4>
            </div>
            <div className="min-h-96 max-h-[32rem] p-4 overflow-y-auto bg-background typography"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-muted border border-secondary rounded-lg p-4 text-sm text-tertiary">
        <strong>Workflow:</strong>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>Select or create a branch (avoid committing directly to master)</li>
          <li>Make your changes to the post content</li>
          <li>Click "Save Changes" to commit to your selected branch</li>
          <li>Click "Create PR" to open a pull request, or "View PR" if one already exists</li>
        </ol>
        <div className="mt-3 text-xs">
          <strong>Note:</strong> After saving, additional changes to the same branch will automatically update the existing PR (no need to create a new one).
        </div>
      </div>
    </div>
  );
}