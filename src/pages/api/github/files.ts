import type { APIRoute } from 'astro';
import { getGithub, json } from '@/lib/github';
import { requireAuth } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const gh = getGithub();
  if (!gh) return json({ error: 'GitHub token not configured' }, 500);
  const { octokit, owner, repo } = gh;

  try {
    const path = url.searchParams.get('path') || '';
    const branch = url.searchParams.get('branch') || 'master';

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

          return json({
            content,
            sha: data.sha,
            path: data.path,
            name: data.name,
          });
        }

        console.error('File data issue - no content field:', {
          dataKeys: Object.keys(data),
          type: Array.isArray(data) ? 'array' : ('type' in data ? data.type : 'unknown'),
          hasContent: 'content' in data,
        });
        return json(
          {
            error: 'File has no content or is not a file',
            debug: {
              type: Array.isArray(data) ? 'array' : ('type' in data ? data.type : 'unknown'),
              hasContent: 'content' in data,
              dataKeys: Object.keys(data),
            },
          },
          400
        );
      } catch (error: any) {
        console.error('GitHub API error:', error);
        if (error.status === 404) {
          return json({ error: 'File not found' }, 404);
        }
        return json(
          { error: 'GitHub API error', details: error.message, status: error.status },
          500
        );
      }
    }

    // List files in src/notes directory
    const { data: files } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'src/notes',
      ref: branch,
    });

    if (Array.isArray(files)) {
      const noteFilesPromises = files
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

      const noteFiles = await Promise.all(noteFilesPromises);

      return json({ files: noteFiles });
    }

    return json({ error: 'Invalid directory structure' }, 500);
  } catch (error) {
    console.error('Error with files API:', error);
    return json({ error: 'Failed to process request' }, 500);
  }
};
