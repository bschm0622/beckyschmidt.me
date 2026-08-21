import { githubRoute, DEFAULT_BRANCH } from '@/lib/github';
import { json } from '@/lib/http';

export const prerender = false;

export const POST = githubRoute(async ({ octokit, owner, repo }, { request }) => {
  const body = await request.json();
  const { branchName, fromBranch = DEFAULT_BRANCH } = body;

  if (!branchName) {
    return json({ error: 'Missing required field: branchName' }, 400);
  }

  // Get the SHA of the source branch
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${fromBranch}`,
  });

  try {
    const response = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha,
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
    // Handle branch already exists error
    if (error.status === 422 && error.message.includes('already exists')) {
      return json(
        {
          error: 'Branch already exists',
          details: `Branch '${branchName}' already exists`,
        },
        409
      );
    }
    throw error;
  }
}, 'Failed to create branch');
