import { githubRoute, DEFAULT_BRANCH, NOTES_DIR } from '@/lib/github';
import { json } from '@/lib/http';

export const prerender = false;

export const POST = githubRoute(async ({ octokit, owner, repo }, { request }) => {
  const body = await request.json();
  const { filename, sha, branch = DEFAULT_BRANCH, message } = body;

  if (!filename || !sha) {
    return json({ error: 'Missing required fields: filename, sha' }, 400);
  }

  // Refuse to delete directly on protected branches, matching the save flow.
  if (['master', 'main'].includes(branch)) {
    return json({ error: 'Cannot delete on a protected branch. Select a feature branch.' }, 400);
  }

  const response = await octokit.rest.repos.deleteFile({
    owner,
    repo,
    path: `${NOTES_DIR}${filename}`,
    message: message || `Delete ${filename} via CMS`,
    sha,
    branch,
  });

  return json({ success: true, commit: response.data.commit });
}, 'Failed to delete file');
