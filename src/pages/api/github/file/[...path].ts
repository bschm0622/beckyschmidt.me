import type { APIRoute } from 'astro';
import { getGithub, json } from '@/lib/github';
import { requireAuth } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ request, params, url }) => {
  // Get the file path from the URL params early so it's available in catch block
  const pathArray = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const filePath = pathArray.join('/');
  const branch = url.searchParams.get('branch') || 'master';

  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const gh = getGithub();
  if (!gh) return json({ error: 'GitHub token not configured' }, 500);
  const { octokit, owner, repo } = gh;

  try {
    if (!filePath) {
      return json({ error: 'No file path provided' }, 400);
    }

    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });

    // Handle the case where data could be an array (directory) or single file
    if (Array.isArray(data)) {
      return json({ error: 'Path is a directory, not a file', path: filePath }, 400);
    }

    // Only files have content property
    if (data.type !== 'file') {
      return json({ error: 'Path is not a file', type: data.type, path: filePath }, 400);
    }

    if (data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf8');

      return json({
        content,
        sha: data.sha,
        path: data.path,
        name: data.name,
      });
    }

    console.error('File data issue - no content field:', {
      dataKeys: Object.keys(data),
      type: data.type,
      hasContent: 'content' in data,
    });
    return json({ error: 'File has no content', type: data.type, path: filePath }, 400);
  } catch (error: any) {
    console.error('GitHub API error in individual file endpoint:', {
      error: error.message,
      status: error.status,
      filePath,
      stack: error.stack,
    });

    if (error.status === 404) {
      return json({ error: 'File not found', path: filePath }, 404);
    }

    return json(
      { error: 'GitHub API error', details: error.message, status: error.status, path: filePath },
      500
    );
  }
};
