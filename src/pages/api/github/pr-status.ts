import { githubRoute } from '@/lib/github';
import { json } from '@/lib/http';

export const prerender = false;

export const GET = githubRoute(async ({ octokit, owner, repo }, { url }) => {
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
}, 'Failed to check PR status');
