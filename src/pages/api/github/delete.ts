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
    const { filename, sha, branch = 'master', message } = body;

    if (!filename || !sha) {
      return json({ error: 'Missing required fields: filename, sha' }, 400);
    }

    // Refuse to delete directly on protected branches, matching the save flow.
    if (['master', 'main'].includes(branch)) {
      return json({ error: 'Cannot delete on a protected branch. Select a feature branch.' }, 400);
    }

    const filePath = `src/notes/${filename}`;

    const response = await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path: filePath,
      message: message || `Delete ${filename} via CMS`,
      sha,
      branch,
    });

    return json({ success: true, commit: response.data.commit });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return json({ error: 'Failed to delete file', details: error.message }, 500);
  }
};
