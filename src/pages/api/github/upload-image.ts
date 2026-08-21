import { githubRoute, DEFAULT_BRANCH } from '@/lib/github';
import { json } from '@/lib/http';
import { ALLOWED_TYPES, MAX_FILE_SIZE } from '@/lib/images';

export const prerender = false;

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const POST = githubRoute(async ({ octokit, owner, repo }, { request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const slug = formData.get('slug') as string;
  const branch = formData.get('branch') as string || DEFAULT_BRANCH;
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
  const base64Content = Buffer.from(arrayBuffer).toString('base64');

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
  return json({
    success: true,
    path: `/notes-images/${slug}/${filename}`,
    filename: filename,
    sha: response.data.content?.sha,
    commit: response.data.commit,
  });
}, 'Failed to upload image');
