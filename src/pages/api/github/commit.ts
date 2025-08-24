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
    const { content, filename, message, branch = 'master', sha } = body;

    if (!content || !filename || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: content, filename, message' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    const filePath = `src/blog/${filename}`;
    
    // Create or update file
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(sha && { sha }), // Include SHA if updating existing file
    });

    return new Response(JSON.stringify({ 
      success: true,
      commit: response.data.commit,
      content: response.data.content 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error committing file:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to commit file',
        details: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};