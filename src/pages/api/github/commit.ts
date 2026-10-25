import { githubRoute, DEFAULT_BRANCH, NOTES_DIR } from '@/lib/github';
import { json } from '@/lib/http';

export const prerender = false;

export const POST = githubRoute(async ({ octokit, owner, repo }, { request }) => {
  const body = await request.json();
  const { content, filename, message, branch = DEFAULT_BRANCH, sha } = body;

  if (!content || !filename || !message) {
    return json({ error: 'Missing required fields: content, filename, message' }, 400);
  }

  const response = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: `${NOTES_DIR}${filename}`,
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    ...(sha && { sha }),
  });

  return json({
    success: true,
    commit: response.data.commit,
    content: response.data.content,
  });
}, 'Failed to commit file');
