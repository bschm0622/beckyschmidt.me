import type { APIRoute, APIContext } from 'astro';
import { Octokit } from '@octokit/rest';
import { getSecret, GITHUB_OWNER, GITHUB_REPO } from 'astro:env/server';
import { json } from '@/lib/http';
import { requireAuth } from '@/lib/session';

export { DEFAULT_BRANCH, CMS_BRANCH_PREFIX, NOTES_DIR } from '@/lib/constants';

export interface GithubContext {
  octokit: Octokit;
  owner: string;
  repo: string;
}

export function getGithub(): GithubContext | null {
  const token = getSecret('GITHUB_TOKEN');
  if (!token) return null;
  return {
    octokit: new Octokit({ auth: token }),
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  };
}

type GithubHandler = (
  gh: GithubContext,
  ctx: Pick<APIContext, 'request' | 'url' | 'params'>
) => Promise<Response>;

export function githubRoute(handler: GithubHandler, errorMessage: string): APIRoute {
  return async ({ request, url, params }) => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const gh = getGithub();
    if (!gh) return json({ error: 'GitHub token not configured' }, 500);

    try {
      return await handler(gh, { request, url, params });
    } catch (error: any) {
      console.error(`${errorMessage}:`, error);
      return json({ error: errorMessage, details: error.message }, 500);
    }
  };
}
