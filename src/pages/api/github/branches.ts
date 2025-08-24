import { Octokit } from '@octokit/rest';
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
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

    const octokit = new Octokit({
      auth: githubToken,
    });

    const { data: branches } = await octokit.rest.repos.listBranches({
      owner,
      repo,
    });

    const branchData = branches.map(branch => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
    }));

    return new Response(JSON.stringify({ branches: branchData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch branches' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};