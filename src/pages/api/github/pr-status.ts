import type { APIRoute } from 'astro';
import { getGithub, json } from '@/lib/github';
import { requireAuth } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const gh = getGithub();
  if (!gh) return json({ error: 'GitHub token not configured' }, 500);
  const { octokit, owner, repo } = gh;

  try {
    const branch = url.searchParams.get('branch');

    if (!branch) {
      return json({ error: 'Branch parameter is required' }, 400);
    }

    // Check for existing PR from this branch
    const response = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: 'open',
    });

    const existingPR = response.data[0];

    return json({
      success: true,
      hasPR: !!existingPR,
      pullRequest: existingPR
        ? {
            number: existingPR.number,
            url: existingPR.html_url,
            title: existingPR.title,
            state: existingPR.state,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error checking PR status:', error);
    return json({ error: 'Failed to check PR status', details: error.message }, 500);
  }
};
