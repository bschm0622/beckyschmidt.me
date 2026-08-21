import { githubRoute, DEFAULT_BRANCH, NOTES_DIR } from '@/lib/github';
import { json } from '@/lib/http';

export const prerender = false;

// Serves a single note file from src/notes/ (content + sha) for the editor.
export const GET = githubRoute(async ({ octokit, owner, repo }, { params, url }) => {
  const filename = params.filename;
  const branch = url.searchParams.get('branch') || DEFAULT_BRANCH;

  if (!filename) {
    return json({ error: 'No filename provided' }, 400);
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `${NOTES_DIR}${filename}`,
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== 'file' || !data.content) {
      return json({ error: 'Path is not a readable file', path: `${NOTES_DIR}${filename}` }, 400);
    }

    return json({
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      sha: data.sha,
      path: data.path,
      name: data.name,
    });
  } catch (error: any) {
    if (error.status === 404) {
      return json({ error: 'File not found', path: `${NOTES_DIR}${filename}` }, 404);
    }
    throw error;
  }
}, 'Failed to fetch note');
