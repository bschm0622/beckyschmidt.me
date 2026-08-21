import { githubRoute, DEFAULT_BRANCH } from '@/lib/github';
import { json } from '@/lib/http';

export const prerender = false;

export const POST = githubRoute(async ({ octokit, owner, repo }, { request }) => {
  const body = await request.json();
  const {
    title,
    body: prBody = '',
    head,
    base = DEFAULT_BRANCH,
    draft = false,
  } = body;

  if (!title || !head) {
    return json({ error: 'Missing required fields: title, head' }, 400);
  }

  const response = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body: prBody,
    head,
    base,
    draft,
  });

  return json({
    success: true,
    pullRequest: {
      number: response.data.number,
      url: response.data.html_url,
      title: response.data.title,
      state: response.data.state,
    },
  });
}, 'Failed to create pull request');
