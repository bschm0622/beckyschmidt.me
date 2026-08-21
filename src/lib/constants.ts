// Isomorphic CMS constants — safe to import from both server routes and the
// browser client (cms-api.ts). Server code usually imports these via
// @/lib/github, which re-exports them.

export const DEFAULT_BRANCH = 'master';
export const CMS_BRANCH_PREFIX = 'cms/';
export const NOTES_DIR = 'src/notes/';
