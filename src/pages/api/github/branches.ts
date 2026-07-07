import type { APIRoute } from 'astro';
import { getGithub, json } from '@/lib/github';
import { requireAuth } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const gh = getGithub();
  if (!gh) return json({ error: 'GitHub token not configured' }, 500);
  const { octokit, owner, repo } = gh;

  try {
    const { data: branches } = await octokit.rest.repos.listBranches({
      owner,
      repo,
    });

    const branchData = branches.map(branch => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
    }));

    return json({ branches: branchData });
  } catch (error) {
    console.error('Error fetching branches:', error);
    return json({ error: 'Failed to fetch branches' }, 500);
  }
};
