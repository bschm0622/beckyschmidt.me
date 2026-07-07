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
    const {
      title,
      body: prBody = '',
      head,
      base = 'master',
      draft = false,
    } = body;

    if (!title || !head) {
      return json({ error: 'Missing required fields: title, head' }, 400);
    }

    // Create pull request
    const response = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body: prBody,
      head,
      base,
      draft,
    });

    return json({
      success: true,
      pullRequest: {
        number: response.data.number,
        url: response.data.html_url,
        title: response.data.title,
        state: response.data.state,
      },
    });
  } catch (error: any) {
    console.error('Error creating pull request:', error);
    return json({ error: 'Failed to create pull request', details: error.message }, 500);
  }
};
