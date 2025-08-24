import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import MarkdownIt from 'markdown-it';

interface FrontMatter {
  title: string;
  slug: string;
  pubDate: string;
  description: string;
  author: string;
  tags: string;
}

interface MarkdownEditorProps {
  initialContent?: string;
  onContentChange?: (content: string, frontMatter: FrontMatter) => void;
}

export default function MarkdownEditor({ initialContent = '', onContentChange }: MarkdownEditorProps) {
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

  const mdParser = new MarkdownIt();

  // Parse initial content if provided
  useEffect(() => {
    if (initialContent) parseMarkdownWithFrontMatter(initialContent);
  }, [initialContent]);

  // Update preview when markdownContent changes
  useEffect(() => {
    updatePreview(markdownContent);
  }, [markdownContent]);

  const parseMarkdownWithFrontMatter = (content: string) => {
    const frontMatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (match) {
      const [, frontMatterStr, contentStr] = match;

      const parsedFrontMatter = { ...frontMatter };
      frontMatterStr.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          let value = valueParts.join(':').trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (key.trim() in parsedFrontMatter) {
            (parsedFrontMatter as any)[key.trim()] = value;
          }
        }
      });

      setFrontMatter(parsedFrontMatter);
      setMarkdownContent(contentStr.trim());
    } else {
      setMarkdownContent(content);
    }
  };

  const generateFullMarkdownWith = (fm: FrontMatter, content: string) => {
    const frontMatterStr = `---
title: ${fm.title}
slug: ${fm.slug}
pubDate: ${fm.pubDate}
author: ${fm.author}
description: ${fm.description}
tags: ${fm.tags}
---`;

    return `${frontMatterStr}\n${content}`;
  };

  const handleFrontMatterChange = (field: keyof FrontMatter, value: string) => {
    setFrontMatter(prev => {
      const newFrontMatter = { ...prev, [field]: value };
      if (onContentChange) {
        const fullMarkdown = generateFullMarkdownWith(newFrontMatter, markdownContent);
        onContentChange(fullMarkdown, newFrontMatter);
      }
      return newFrontMatter;
    });
  };

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdownContent(value);
    if (onContentChange) {
      const fullMarkdown = generateFullMarkdownWith(frontMatter, value);
      onContentChange(fullMarkdown, frontMatter);
    }
  }, [frontMatter, onContentChange]);

  const updatePreview = (content: string) => {
    if (!content.trim()) {
      setPreviewHtml('Preview will appear here...');
      return;
    }
    // Render Markdown using markdown-it for Astro-compatible preview
    setPreviewHtml(mdParser.render(content));
  };

  return (
    <div className="space-y-6">
      {/* Front Matter Editor */}
      <div className="bg-surface border border-muted rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Post Metadata</h3>
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
              placeholder="tag1,tag2,tag3"
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
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${activeTab === 'editor'
                ? 'bg-primary text-white'
                : 'bg-surface text-tertiary hover:text-foreground'
              }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${activeTab === 'preview'
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
            <div className="bg-secondary px-4 py-2 border-b border-muted">
              <h4 className="font-medium text-foreground">Markdown Editor</h4>
            </div>
            <div className="h-96">
              <CodeMirror
                value={markdownContent}
                onChange={handleMarkdownChange}
                extensions={[markdown()]}
                theme={oneDark}
                placeholder="Write your markdown content here..."
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
                  height: '100%',
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
            <div className="h-96 p-4 overflow-y-auto bg-background typography"
              dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
}
