import { Octokit } from '@octokit/rest';
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  // Get the file path from the URL params early so it's available in catch block
  const pathArray = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const filePath = pathArray.join('/');
  const branch = url.searchParams.get('branch') || 'master';
  
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

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'No file path provided' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    console.log('Fetching specific file:', filePath);
    
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });

    // Handle the case where data could be an array (directory) or single file
    if (Array.isArray(data)) {
      return new Response(
        JSON.stringify({ 
          error: 'Path is a directory, not a file',
          path: filePath
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Only files have content property
    if (data.type !== 'file') {
      return new Response(
        JSON.stringify({ 
          error: 'Path is not a file',
          type: data.type,
          path: filePath
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }


    if (data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      
      return new Response(JSON.stringify({ 
        content,
        sha: data.sha,
        path: data.path,
        name: data.name 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      console.error('File data issue - no content field:', { 
        dataKeys: Object.keys(data),
        type: data.type,
        hasContent: 'content' in data 
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'File has no content',
          type: data.type,
          path: filePath
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('GitHub API error in individual file endpoint:', {
      error: error.message,
      status: error.status,
      filePath,
      stack: error.stack
    });
    
    if (error.status === 404) {
      return new Response(
        JSON.stringify({ 
          error: 'File not found',
          path: filePath
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'GitHub API error', 
        details: error.message,
        status: error.status,
        path: filePath
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};