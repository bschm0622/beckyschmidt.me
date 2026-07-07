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
    const { branchName, fromBranch = 'master' } = body;

    if (!branchName) {
      return json({ error: 'Missing required field: branchName' }, 400);
    }

    // Get the SHA of the source branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${fromBranch}`,
    });

    const sha = refData.object.sha;

    // Create new branch
    const response = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha,
    });

    return json({
      success: true,
      branch: {
        name: branchName,
        sha: response.data.object.sha,
        ref: response.data.ref,
      },
    });
  } catch (error: any) {
    console.error('Error creating branch:', error);

    // Handle branch already exists error
    if (error.status === 422 && error.message.includes('already exists')) {
      return json(
        {
          error: 'Branch already exists',
          details: `Branch '${error.request?.ref?.split('/').pop()}' already exists`,
        },
        409
      );
    }

    return json({ error: 'Failed to create branch', details: error.message }, 500);
  }
};
