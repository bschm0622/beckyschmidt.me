import { Octokit } from '@octokit/rest';
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
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

    const url = new URL(request.url);
    const branch = url.searchParams.get('branch');

    if (!branch) {
      return new Response(
        JSON.stringify({ error: 'Branch parameter is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    // Check for existing PR from this branch
    const response = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: 'open',
    });

    const existingPR = response.data[0];

    return new Response(JSON.stringify({ 
      success: true,
      hasPR: !!existingPR,
      pullRequest: existingPR ? {
        number: existingPR.number,
        url: existingPR.html_url,
        title: existingPR.title,
        state: existingPR.state,
      } : null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error checking PR status:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to check PR status',
        details: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};