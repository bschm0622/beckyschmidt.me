import { Octokit } from '@octokit/rest';
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const githubToken = import.meta.env.GITHUB_TOKEN;
    const owner = import.meta.env.GITHUB_OWNER;
    const repo = import.meta.env.GITHUB_REPO;
    const path = url.searchParams.get('path') || '';
    const branch = url.searchParams.get('branch') || 'master';

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
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });


        if ('content' in data && data.content) {
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
            type: Array.isArray(data) ? 'array' : ('type' in data ? data.type : 'unknown'),
            hasContent: 'content' in data 
          });
          return new Response(
            JSON.stringify({ 
              error: 'File has no content or is not a file',
              debug: {
                type: Array.isArray(data) ? 'array' : ('type' in data ? data.type : 'unknown'),
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
      const blogFilesPromises = files
        .filter(file => file.type === 'file' && file.name.endsWith('.md'))
        .map(async (file) => {
          try {
            // Fetch the file content to extract frontmatter
            const { data: fileContent } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: file.path!,
              ref: branch,
            });

            let pubDate = null;
            if ('content' in fileContent && fileContent.content) {
              const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
              
              // Extract pubDate from frontmatter
              const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
              if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                const pubDateMatch = frontmatter.match(/pubDate:\s*([^\n\r]+)/);
                if (pubDateMatch) {
                  pubDate = pubDateMatch[1].trim();
                }
              }
            }

            return {
              name: file.name,
              path: file.path,
              sha: file.sha,
              pubDate: pubDate,
            };
          } catch (error) {
            console.error(`Error fetching content for ${file.name}:`, error);
            return {
              name: file.name,
              path: file.path,
              sha: file.sha,
              pubDate: null,
            };
          }
        });

      const blogFiles = await Promise.all(blogFilesPromises);

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