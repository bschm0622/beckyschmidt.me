import { githubRoute, DEFAULT_BRANCH, NOTES_DIR } from '@/lib/github';
import { json } from '@/lib/http';
import { parseFrontmatter } from '@/lib/frontmatter';

export const prerender = false;

// Lists the notes in src/notes/ with the frontmatter fields the dashboard shows.
export const GET = githubRoute(async ({ octokit, owner, repo }, { url }) => {
  const branch = url.searchParams.get('branch') || DEFAULT_BRANCH;

  const { data: files } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: NOTES_DIR.replace(/\/$/, ''),
    ref: branch,
  });

  if (!Array.isArray(files)) {
    return json({ error: 'Invalid directory structure' }, 500);
  }

  const noteFiles = await Promise.all(
    files
      .filter((file) => file.type === 'file' && file.name.endsWith('.md'))
      .map(async (file) => {
        const base = { name: file.name, path: file.path, sha: file.sha };
        try {
          // Fetch the file content to extract frontmatter
          const { data: fileContent } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path!,
            ref: branch,
          });

          let title: string | null = null;
          let pubDate: string | null = null;
          let description: string | null = null;
          if ('content' in fileContent && fileContent.content) {
            const raw = Buffer.from(fileContent.content, 'base64').toString('utf8');
            const { data } = parseFrontmatter(raw);
            const field = (name: string) =>
              typeof data[name] === 'string' ? (data[name] as string) : null;
            title = field('title');
            pubDate = field('pubDate');
            description = field('description');
          }

          return { ...base, title, pubDate, description };
        } catch (error) {
          console.error(`Error fetching content for ${file.name}:`, error);
          return { ...base, title: null, pubDate: null, description: null };
        }
      })
  );

  return json({ files: noteFiles });
}, 'Failed to list notes');
