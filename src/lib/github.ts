import { Octokit } from '@octokit/rest';
import { getSecret, GITHUB_OWNER, GITHUB_REPO } from 'astro:env/server';

/** JSON Response helper — every API route returns the same content-type. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface GithubContext {
  octokit: Octokit;
  owner: string;
  repo: string;
}

/**
 * Returns a configured Octokit client plus the repo owner/name, or `null`
 * if the server has no GITHUB_TOKEN configured. Centralizes the setup that
 * every /api/github/* route used to duplicate.
 */
export function getGithub(): GithubContext | null {
  const token = getSecret('GITHUB_TOKEN');
  if (!token) return null;
  return {
    octokit: new Octokit({ auth: token }),
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  };
}
