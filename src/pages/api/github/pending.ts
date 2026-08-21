import { githubRoute, CMS_BRANCH_PREFIX, NOTES_DIR } from '@/lib/github';
import { json } from '@/lib/http';

export const prerender = false;

// Lists the CMS's open pull requests — notes that have been published but not yet
// merged to master. These live only on their `cms/…` branch, so the dashboard
// needs this to show them as "In review" and let you keep editing the same PR.
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
      // Find the note file this PR touches so we can label it and reopen it in
      // the editor pointed at the PR's branch.
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
        // If we can't read the files, still surface the PR by title.
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

  // Most recently updated first.
  pending.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  return json({ pending });
}, 'Failed to list pending PRs');
