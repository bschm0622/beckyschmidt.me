import { githubRoute, CMS_BRANCH_PREFIX, NOTES_DIR } from '@/lib/github';
import { json } from '@/lib/http';

export const prerender = false;

export const GET = githubRoute(async ({ octokit, owner, repo }) => {
  const { data: pulls } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  const cmsPulls = pulls.filter((pr) => pr.head.ref.startsWith(CMS_BRANCH_PREFIX));

  const pending = await Promise.all(
    cmsPulls.map(async (pr) => {
      let filename: string | null = null;
      let isDelete = false;
      try {
        const { data: files } = await octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: pr.number,
          per_page: 100,
        });
        const note = files.find(
          (f) => f.filename.startsWith(NOTES_DIR) && f.filename.endsWith('.md')
        );
        if (note) {
          filename = note.filename.replace(NOTES_DIR, '');
          isDelete = note.status === 'removed';
        }
      } catch {
      }

      return {
        number: pr.number,
        url: pr.html_url,
        title: pr.title,
        branch: pr.head.ref,
        updatedAt: pr.updated_at,
        filename,
        isDelete,
      };
    })
  );

  pending.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  return json({ pending });
}, 'Failed to list pending PRs');
