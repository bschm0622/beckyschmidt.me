import { Octokit } from '@octokit/rest';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
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

    const body = await request.json();
    const { 
      title, 
      body: prBody = '', 
      head, 
      base = 'master',
      draft = false 
    } = body;

    if (!title || !head) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, head' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

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

    return new Response(JSON.stringify({ 
      success: true,
      pullRequest: {
        number: response.data.number,
        url: response.data.html_url,
        title: response.data.title,
        state: response.data.state,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error creating pull request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create pull request',
        details: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};