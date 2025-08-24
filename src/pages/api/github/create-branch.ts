import { Octokit } from '@octokit/rest';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const githubToken = import.meta.env.GITHUB_TOKEN;
    const owner = import.meta.env.GITHUB_OWNER || 'bschm0622';
    const repo = import.meta.env.GITHUB_REPO || 'beckyschmidt.me';

    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: 'GitHub token not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json();
    const { branchName, fromBranch = 'master' } = body;

    if (!branchName) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: branchName' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

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

    return new Response(JSON.stringify({ 
      success: true,
      branch: {
        name: branchName,
        sha: response.data.object.sha,
        ref: response.data.ref,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error creating branch:', error);
    
    // Handle branch already exists error
    if (error.status === 422 && error.message.includes('already exists')) {
      return new Response(
        JSON.stringify({ 
          error: 'Branch already exists',
          details: `Branch '${error.request?.ref?.split('/').pop()}' already exists`
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Failed to create branch',
        details: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};