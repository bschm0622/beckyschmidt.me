import { Octokit } from '@octokit/rest';
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const githubToken = import.meta.env.GITHUB_TOKEN;
    const owner = import.meta.env.GITHUB_OWNER || 'bschm0622';
    const repo = import.meta.env.GITHUB_REPO || 'beckyschmidt.me';
    const path = url.searchParams.get('path') || '';
    const branch = url.searchParams.get('branch') || 'master';

    console.log('=== GitHub API Call ===');
    console.log('Request URL:', url.toString());
    console.log('Method:', 'GET');
    console.log('Headers:', 'Content-Type: application/json');
    console.log('GitHub API Debug:', { 
      hasToken: !!githubToken, 
      tokenLength: githubToken?.length || 0,
      owner, 
      repo, 
      path,
      url: url.toString(),
      searchParams: Object.fromEntries(url.searchParams.entries()),
      timestamp: new Date().toISOString()
    });
    console.log('========================');

    if (!githubToken) {
      console.error('GitHub token is missing');
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

    // Get specific file content
    if (path) {
      console.log('Fetching specific file:', path);
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });

        console.log('GitHub file data:', { 
          type: data.type || 'unknown',
          hasContent: 'content' in data,
          contentLength: data.content?.length || 0,
          name: data.name,
          path: data.path
        });

        if ('content' in data && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          console.log('Decoded content length:', content.length);
          console.log('Successfully returning file content');
          
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
              error: 'File has no content or is not a file',
              debug: {
                type: data.type,
                hasContent: 'content' in data,
                dataKeys: Object.keys(data)
              }
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (error: any) {
        console.error('GitHub API error:', error);
        if (error.status === 404) {
          return new Response(
            JSON.stringify({ error: 'File not found' }),
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
            status: error.status 
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // List files in src/blog directory
    const { data: files } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'src/blog',
      ref: branch,
    });

    if (Array.isArray(files)) {
      const blogFiles = files
        .filter(file => file.type === 'file' && file.name.endsWith('.md'))
        .map(file => ({
          name: file.name,
          path: file.path,
          sha: file.sha,
        }));

      return new Response(JSON.stringify({ files: blogFiles }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid directory structure' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error with files API:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};