import type { APIRoute } from 'astro';
import { getGithub, json } from '@/lib/github';
import { requireAuth } from '@/lib/session';

export const prerender = false;

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const POST: APIRoute = async ({ request }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const gh = getGithub();
  if (!gh) return json({ error: 'GitHub token not configured' }, 500);
  const { octokit, owner, repo } = gh;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const slug = formData.get('slug') as string;
    const branch = formData.get('branch') as string || 'master';
    const message = formData.get('message') as string || 'Add note image';
    const providedFilename = formData.get('filename') as string | null;

    // Validation
    if (!file || !slug) {
      return json({ error: 'Missing required fields: file, slug' }, 400);
    }

    // Validate slug — it becomes a directory path segment, so reject anything
    // that could escape public/notes-images/ (e.g. "../src/pages").
    if (!SLUG_PATTERN.test(slug)) {
      return json(
        { error: 'Invalid slug. Use lowercase letters, numbers, and hyphens only.' },
        400
      );
    }

    // Validate provided filename similarly (no slashes or path traversal).
    if (providedFilename && !FILENAME_PATTERN.test(providedFilename)) {
      return json(
        { error: 'Invalid filename. Use letters, numbers, dots, underscores, and hyphens only.' },
        400
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return json(
        { error: 'Invalid file type. Allowed types: JPG, PNG, WEBP, GIF', allowedTypes: ALLOWED_TYPES },
        400
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, maxSize: MAX_FILE_SIZE },
        400
      );
    }

    // Use provided filename or generate new one with timestamp
    const filename = providedFilename || (() => {
      const timestamp = Date.now();
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
      return `${slug}-${timestamp}-${originalName}`;
    })();

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString('base64');

    // Upload to GitHub in public/notes-images/{slug}/
    const filePath = `public/notes-images/${slug}/${filename}`;

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: base64Content,
      branch,
    });

    // Public files are accessible at /notes-images/...
    const relativePath = `/notes-images/${slug}/${filename}`;

    return json({
      success: true,
      path: relativePath,
      filename: filename,
      sha: response.data.content?.sha,
      commit: response.data.commit,
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return json({ error: 'Failed to upload image', details: error.message }, 500);
  }
};
