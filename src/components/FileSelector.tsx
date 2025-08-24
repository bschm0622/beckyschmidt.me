import React, { useState, useEffect } from 'react';

interface BlogPost {
  filename: string;
  title: string;
  slug: string;
  pubDate: string;
}

interface FileSelectorProps {
  selectedFile?: string;
  onFileSelect: (filename: string | null) => void;
  onLoadContent: (content: string) => void;
}

export default function FileSelector({ selectedFile, onFileSelect, onLoadContent }: FileSelectorProps) {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBlogPosts();
  }, []);

  const loadBlogPosts = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/github/files');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load blog posts');
      }

      // Convert GitHub files to BlogPost format
      const posts: BlogPost[] = data.files.map((file: any) => ({
        filename: file.name,
        title: file.name.replace('.md', '').replace(/-/g, ' '),
        slug: file.name.replace('.md', ''),
        pubDate: new Date().toISOString().split('T')[0], // Default date, will be overridden when loading content
      }));
      
      setBlogPosts(posts);
    } catch (err: any) {
      setError(err.message || 'Failed to load blog posts');
      console.error('Error loading blog posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (filename: string | null) => {
    onFileSelect(filename);
    
    if (filename) {
      setError('');
      try {
        const response = await fetch(`/api/github/file/src/blog/${filename}`);
        const data = await response.json();

        if (response.ok) {
          onLoadContent(data.content);
        } else {
          throw new Error(data.error || 'Failed to load file');
        }
      } catch (err: any) {
        setError(`Failed to load ${filename}: ${err.message}`);
        console.error('Error loading file content:', err);
        
        // Fallback with sample content
        const sampleContent = `---
title: "Sample Blog Post"
slug: sample-blog-post
pubDate: ${new Date().toISOString().split('T')[0]}
description: Sample description for this blog post
author: Becky Schmidt
tags: sample,demo
---

# Sample Blog Post

Error loading content from GitHub. This is a fallback template.

## Next Steps

1. Check your GitHub token configuration
2. Ensure the repository and file permissions are correct
3. Try refreshing the page

You can still edit and save this content!`;
        onLoadContent(sampleContent);
      }
    } else {
      onLoadContent('');
    }
  };

  const handleCreateNew = () => {
    const newContent = `---
title: "New Blog Post"
slug: new-blog-post
pubDate: ${new Date().toISOString().split('T')[0]}
description: Description for your new blog post
author: Becky Schmidt
tags: new,draft
---

# New Blog Post

Start writing your new blog post here...

## Introduction

Add your content here.`;
    
    onFileSelect(null);
    onLoadContent(newContent);
  };

  return (
    <div className="bg-surface border border-muted rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">Select Post</h3>
        <button
          onClick={handleCreateNew}
          className="bg-primary text-white px-4 py-2 rounded-md hover:opacity-80 transition-opacity text-sm font-medium"
        >
          New Post
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <div className="mb-2">
          <button
            onClick={() => handleFileSelect(null)}
            className={`w-full text-left p-3 rounded-md transition-colors ${
              !selectedFile
                ? 'bg-primary text-white'
                : 'bg-background border border-muted hover:bg-secondary text-foreground'
            }`}
          >
            <div className="font-medium">Create New Post</div>
            <div className="text-sm opacity-75">Start with a blank template</div>
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-tertiary">
            Loading blog posts...
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {blogPosts.map((post) => (
              <button
                key={post.filename}
                onClick={() => handleFileSelect(post.filename)}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  selectedFile === post.filename
                    ? 'bg-primary text-white'
                    : 'bg-background border border-muted hover:bg-secondary text-foreground'
                }`}
              >
                <div className="font-medium">{post.title}</div>
                <div className="text-sm opacity-75">
                  {post.filename} • {post.pubDate}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {blogPosts.length === 0 && !isLoading && (
        <div className="text-center py-8 text-tertiary">
          No blog posts found. Click "New Post" to create your first post.
        </div>
      )}
    </div>
  );
}