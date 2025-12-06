import { Octokit } from '@octokit/rest';
import type { APIRoute } from 'astro';

export const prerender = false;

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export const POST: APIRoute = async ({ request }) => {
  try {
    const githubToken = import.meta.env.GITHUB_TOKEN;
    const owner = import.meta.env.GITHUB_OWNER;
    const repo = import.meta.env.GITHUB_REPO;

    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: 'GitHub token not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const slug = formData.get('slug') as string;
    const branch = formData.get('branch') as string || 'master';
    const message = formData.get('message') as string || 'Add blog image';

    // Validation
    if (!file || !slug) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, slug' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid file type. Allowed types: JPG, PNG, WEBP, GIF',
          allowedTypes: ALLOWED_TYPES
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          maxSize: MAX_FILE_SIZE
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate filename with timestamp
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-'); // Sanitize filename
    const filename = `${slug}-${timestamp}-${originalName}`;

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString('base64');

    const octokit = new Octokit({
      auth: githubToken,
    });

    // Upload to GitHub in src/assets/blog-images/{slug}/
    const filePath = `src/assets/blog-images/${slug}/${filename}`;

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: base64Content,
      branch,
    });

    // Calculate relative path from src/blog/ to src/assets/blog-images/
    const relativePath = `../../assets/blog-images/${slug}/${filename}`;

    return new Response(JSON.stringify({
      success: true,
      path: relativePath,
      filename: filename,
      sha: response.data.content?.sha,
      commit: response.data.commit
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to upload image',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
