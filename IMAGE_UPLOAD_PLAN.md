# Plan: Add Image Upload Support to Blog Editor

## Overview
Add the ability to upload and embed images in blog posts through the BlogEditor interface, with images stored in the GitHub repository alongside the blog content.

## Recommended Approach

### 1. Image Storage Location
**Decision: Store images in `src/assets/blog-images/`**

**Rationale:**
- Enables Astro's built-in image optimization
- Automatic WebP conversion and responsive sizing
- Better performance for blog readers
- Images processed during build time
- Can use Astro's `<Picture>` component

**Directory Structure:**
```
src/
  assets/
    blog-images/
      post-slug-name/
        image-1.jpg
        image-2.png
```

Organize by post slug to prevent naming conflicts and keep images grouped logically.

### 2. Upload UI Design
**Decision: File picker button only**

- **File picker button** in BlogEditor toolbar
- Simple, focused UX
- For markdown editor: inserts standard markdown syntax at cursor position
- Note: Markdown will use image imports since images are in `src/assets/`

### 3. File Naming Strategy
**Decision: Prefix with post slug + timestamp**

Format: `{post-slug}-{timestamp}-{original-filename}`

Example: `my-blog-post-1234567890-screenshot.png`

**Benefits:**
- Prevents conflicts between posts
- Maintains original filename for clarity
- Timestamp ensures uniqueness
- Easy to trace back to source post

### 4. Image Processing & Display
**Decision: Client-side optimization + Astro Image component for display**

**Upload Processing:**
- Maximum width: 1200px (maintain aspect ratio)
- Convert large images to JPEG with 85% quality
- Maximum file size: 2MB (warn if larger)
- Support formats: JPG, PNG, WEBP, GIF
- Preserve GIFs and small PNGs without conversion

**Display in Blog Posts:**
- Use Astro's `<Picture>` component for optimized rendering
- Store images in `src/assets/blog-images/` instead of `public/` to enable Astro optimization
- This allows automatic format conversion (WebP), responsive sizing, and lazy loading

**Rationale:**
- Astro Image optimization provides better performance
- Automatic responsive images and modern formats
- Keeps repository size manageable with client-side optimization
- GitHub has file size limits

### 5. Image Management
**Decision: Start simple, add gallery later if needed**

**Phase 1 (MVP):**
- Upload new images only
- Show upload progress/status
- Display error messages for failures

**Future enhancement:**
- Image browser to view/reuse existing images
- Bulk upload support
- Image deletion capability

## Implementation Plan

### Step 1: Create Image Upload API Endpoint
**File: `src/pages/api/github/upload-image.ts`**

**Functionality:**
- Accept multipart form data (image file + metadata)
- Validate file type and size
- Convert to Base64 for GitHub API
- Commit to `src/assets/blog-images/{slug}/` in the current branch
- Return the relative path for import usage
- Handle errors (file too large, invalid format, GitHub API errors)

**Request:**
```typescript
POST /api/github/upload-image
Content-Type: multipart/form-data

{
  file: File,
  slug: string,
  branch: string,
  message: string
}
```

**Response:**
```typescript
{
  success: true,
  path: "../../assets/blog-images/post-slug/image.jpg",
  sha: "abc123..."
}
```

### Step 2: Add Client-Side Image Processing Utility
**File: `src/utils/imageProcessor.ts` (new file)**

**Functions:**
- `optimizeImage(file: File): Promise<File>` - Resize and compress
- `validateImage(file: File): { valid: boolean, error?: string }` - Check format/size
- `generateImageFilename(originalName: string, slug: string): string` - Create unique name

### Step 3: Update BlogEditor Component
**File: `src/components/BlogEditor.tsx`**

**Changes:**
1. Add image upload state management
2. Create `handleImageUpload` function:
   - Validate image
   - Optimize image
   - Call upload API
   - Get cursor position from CodeMirror
   - Insert markdown syntax `![Alt text](path/to/image.jpg)` at cursor position
   - Show progress/success/error states
   - Display success message with the inserted markdown

3. Add UI elements:
   - Image upload button in toolbar (above markdown editor)
   - File input (hidden, triggered by button)
   - Upload progress indicator
   - Success/error message display showing the inserted image path

**User Workflow:**
1. Position your cursor in the markdown editor where you want the image
2. Click the "Upload Image" button
3. Select an image file from your computer
4. The image uploads to GitHub automatically
5. Markdown syntax is automatically inserted at your cursor position: `![Description](../../assets/blog-images/post-slug/image-name.jpg)`
6. A success message shows you the path that was inserted
7. The preview pane immediately shows the uploaded image
8. You can edit the alt text ("Description") to make it more meaningful

### Step 4: Update CodeMirror Integration
**File: `src/components/BlogEditor.tsx`**

**Add extensions/config for:**
- Cursor position tracking (to insert markdown at correct location)

### Step 5: Enhance Markdown Preview
**File: `src/components/BlogEditor.tsx`**

**Changes:**
- Ensure markdown-it renders images in preview
- Handle relative paths correctly in preview
- Show loading placeholder while image uploads

## Data Flow

1. **User Action:** User clicks upload button
2. **Validation:** Client validates file type and size
3. **Optimization:** Client resizes/compresses image
4. **Upload:** Client sends optimized image to `/api/github/upload-image`
5. **GitHub Commit:** API commits image to `src/assets/blog-images/{slug}/` on current branch
6. **Response:** API returns relative import path
7. **Insertion:** Client inserts `![description](../../assets/blog-images/{slug}/image.jpg)` at cursor
8. **Preview:** Markdown preview renders image (may need special handling for assets)
9. **Save:** User saves blog post (images already committed to same branch)
10. **PR/Merge:** Images merge to master with blog post content
11. **Build:** Astro processes images through Image optimization and generates optimized versions

## Files to Create

1. `src/pages/api/github/upload-image.ts` - Image upload API endpoint
2. `src/utils/imageProcessor.ts` - Client-side image optimization utilities

## Files to Modify

1. `src/components/BlogEditor.tsx` - Add upload UI and handlers
2. `package.json` - Add image processing dependencies if needed (e.g., `browser-image-compression`)
3. `astro.config.mjs` - May need to verify/add image integration if not already present

## Important Implementation Note

**Astro Image Optimization in Markdown:**
- Astro supports optimized images in markdown through relative paths when using the content collections
- The markdown processor will automatically optimize images referenced with relative paths like `![alt](../../assets/blog-images/slug/image.jpg)`
- This works because blog posts are in `src/blog/` and images will be in `src/assets/blog-images/`
- Astro's build process will handle the conversion to optimized formats during build time
- No need to manually use `<Picture>` component in markdown - Astro handles this automatically

## Error Handling

### Client-side errors:
- File too large (> 2MB after optimization)
- Invalid file format
- Image optimization failure
- No internet connection

### Server-side errors:
- GitHub API rate limit
- GitHub API failure (network, auth, etc.)
- File already exists (SHA conflict)
- Invalid branch name

All errors should display user-friendly messages in the BlogEditor UI.

## Edge Cases to Handle

1. **Uploading same image twice:** Timestamp in filename prevents conflicts
2. **Uploading before saving post:** Images use current slug, which might change - acceptable tradeoff for simplicity
3. **Deleting post with images:** Images remain in repo - manual cleanup or future feature
4. **Large batch uploads:** Handle sequentially with progress indicator
5. **Network interruption during upload:** Show error, allow retry
6. **Unsaved blog post:** Use "untitled" or temporary slug for images

## Testing Checklist

- [ ] Upload JPG, PNG, WEBP, GIF files
- [ ] Upload image larger than 1200px (verify resize)
- [ ] Upload image larger than 2MB (verify compression or error)
- [ ] Upload invalid file type (verify error message)
- [ ] Drag and drop image onto editor
- [ ] Paste image from clipboard
- [ ] Upload multiple images in sequence
- [ ] Verify image appears in preview immediately
- [ ] Verify markdown syntax is correct
- [ ] Verify image committed to correct branch on GitHub
- [ ] Verify image accessible after PR merge and build
- [ ] Test with special characters in filename
- [ ] Test concurrent uploads

## Future Enhancements

1. **Image Gallery:** Browse and reuse existing images from repo
2. **Image Editing:** Basic crop/resize in browser before upload
3. **Alt Text Prompt:** Prompt user for accessibility description
4. **Image Deletion:** Delete unused images from GitHub
5. **Bulk Upload:** Upload multiple images at once
6. **Copy/Paste Markdown:** Copy markdown from other sources with embedded images
7. **External Images:** Support for image URLs (no upload needed)
8. **Image Optimization Settings:** User-configurable quality/size settings
