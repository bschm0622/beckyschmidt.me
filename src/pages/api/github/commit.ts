import type { APIRoute } from 'astro';
import { getGithub, json } from '@/lib/github';
import { requireAuth } from '@/lib/session';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const gh = getGithub();
  if (!gh) return json({ error: 'GitHub token not configured' }, 500);
  const { octokit, owner, repo } = gh;

  try {
    const body = await request.json();
    const { content, filename, message, branch = 'master', sha } = body;

    if (!content || !filename || !message) {
      return json({ error: 'Missing required fields: content, filename, message' }, 400);
    }

    const filePath = `src/notes/${filename}`;

    // Create or update file
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(sha && { sha }), // Include SHA if updating existing file
    });

    return json({
      success: true,
      commit: response.data.commit,
      content: response.data.content,
    });
  } catch (error: any) {
    console.error('Error committing file:', error);
    return json({ error: 'Failed to commit file', details: error.message }, 500);
  }
};
