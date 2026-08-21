// Typed client for the CMS API routes. This is the single client↔server
// contract: every interface here matches exactly what the corresponding
// route in src/pages/api/ returns.

import { CMS_BRANCH_PREFIX, DEFAULT_BRANCH } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Shared types

/** Commit object as returned by GitHub's contents API. */
export interface CommitInfo {
  sha: string;
  html_url?: string;
  [key: string]: unknown;
}

/** GET /api/github/notes — one entry per note file. */
export interface NoteListItem {
  name: string;
  path: string;
  sha: string;
  title: string | null;
  pubDate: string | null;
  description: string | null;
}

/** GET /api/github/note/[filename] — a single note's raw content. */
export interface NoteFile {
  content: string;
  sha: string;
  path: string;
  name: string;
}

/** POST /api/github/commit */
export interface CommitResult {
  success: true;
  commit: CommitInfo;
  content: { sha: string; [key: string]: unknown } | null;
}

/** POST /api/github/create-branch */
export interface BranchResult {
  success: true;
  branch: { name: string; sha: string; ref: string };
}

export interface PrInfo {
  number: number;
  url: string;
  title: string;
  state: string;
}

/** POST /api/github/create-pr */
export interface CreatePrResult {
  success: true;
  pullRequest: PrInfo;
}

/** GET /api/github/pr-status */
export interface PrStatusResult {
  success: true;
  hasPR: boolean;
  pullRequest: PrInfo | null;
}

/** GET /api/github/pending — an open cms/ PR awaiting merge. */
export interface PendingPR {
  number: number;
  url: string;
  title: string;
  branch: string;
  updatedAt: string;
  filename: string | null;
  isDelete: boolean;
}

/** POST /api/github/delete */
export interface DeleteResult {
  success: true;
  commit: CommitInfo;
}

/** POST /api/github/upload-image */
export interface UploadImageResult {
  success: true;
  path: string;
  filename: string;
  sha?: string;
  commit: CommitInfo;
}

// ---------------------------------------------------------------------------
// Request helper

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Error thrown for non-2xx responses; carries the HTTP status for callers
 *  that need to branch on it (e.g. 401 → back to the login form). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const res = await fetch(path, {
    ...init,
    // FormData bodies set their own multipart content-type.
    headers:
      init.body instanceof FormData
        ? init.headers
        : { ...JSON_HEADERS, ...init.headers },
  });
  if (!res.ok) {
    throw new ApiError((await res.json().catch(() => ({}))).error || fallback, res.status);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// One function per endpoint

export function listNotes(branch = DEFAULT_BRANCH): Promise<{ files: NoteListItem[] }> {
  return request(
    `/api/github/notes?branch=${encodeURIComponent(branch)}`,
    { method: 'GET', headers: { 'Cache-Control': 'no-cache' } },
    'Failed to load notes'
  );
}

export function getNote(filename: string, branch = DEFAULT_BRANCH): Promise<NoteFile> {
  return request(
    `/api/github/note/${encodeURIComponent(filename)}?branch=${encodeURIComponent(branch)}`,
    { method: 'GET', headers: { 'Cache-Control': 'no-cache' } },
    `Failed to load ${filename}`
  );
}

export function commit(input: {
  content: string;
  filename: string;
  message: string;
  branch?: string;
  sha?: string;
}): Promise<CommitResult> {
  return request('/api/github/commit', { method: 'POST', body: JSON.stringify(input) }, 'Failed to save');
}

export function createBranch(branchName: string, fromBranch = DEFAULT_BRANCH): Promise<BranchResult> {
  return request(
    '/api/github/create-branch',
    { method: 'POST', body: JSON.stringify({ branchName, fromBranch }) },
    'Failed to create branch'
  );
}

export function createPr(input: {
  title: string;
  body?: string;
  head: string;
  base?: string;
  draft?: boolean;
}): Promise<CreatePrResult> {
  return request('/api/github/create-pr', { method: 'POST', body: JSON.stringify(input) }, 'Failed to open PR');
}

export function prStatus(branch: string): Promise<PrStatusResult> {
  return request(
    `/api/github/pr-status?branch=${encodeURIComponent(branch)}`,
    { method: 'GET' },
    'Failed to check PR status'
  );
}

export function pending(): Promise<{ pending: PendingPR[] }> {
  return request('/api/github/pending', { method: 'GET' }, 'Failed to list pending PRs');
}

export function deleteNote(input: {
  filename: string;
  sha: string;
  branch: string;
  message?: string;
}): Promise<DeleteResult> {
  return request('/api/github/delete', { method: 'POST', body: JSON.stringify(input) }, 'Failed to delete note');
}

export function uploadImage(input: {
  file: File;
  slug: string;
  branch?: string;
  filename?: string;
  message?: string;
}): Promise<UploadImageResult> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('slug', input.slug);
  if (input.branch) formData.append('branch', input.branch);
  if (input.filename) formData.append('filename', input.filename);
  if (input.message) formData.append('message', input.message);
  return request('/api/github/upload-image', { method: 'POST', body: formData }, 'Failed to upload image');
}

// Auth

export function checkSession(): Promise<{ authenticated: boolean }> {
  return request('/api/auth', { method: 'GET' }, 'Failed to check session');
}

export function login(password: string): Promise<{ success: true }> {
  return request('/api/auth', { method: 'POST', body: JSON.stringify({ password }) }, 'Invalid password');
}

export function logout(): Promise<{ success: true }> {
  return request('/api/auth', { method: 'DELETE' }, 'Failed to log out');
}

// ---------------------------------------------------------------------------
// Higher-level pipelines

/** Creates a cms/ branch off master, tolerating "already exists" (409). */
async function ensureCmsBranch(branch: string): Promise<void> {
  const res = await fetch('/api/github/create-branch', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ branchName: branch, fromBranch: DEFAULT_BRANCH }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error((await res.json().catch(() => ({}))).error || 'Failed to create branch');
  }
}

export interface PublishNoteInput {
  /** Note slug — used for branch naming and image paths. */
  slug: string;
  /** Target filename inside src/notes/ (e.g. "my-note.md"). */
  filename: string;
  /** Full markdown document (frontmatter + body). */
  content: string;
  /** Note title, used for the PR title. */
  title: string;
  /** Note description, used as the PR body. */
  description?: string;
  /** True when updating an existing note (changes the commit message). */
  isUpdate?: boolean;
  /** Existing session branch to reuse; a new cms/ branch is created if omitted. */
  branch?: string | null;
  /** Blob SHA of the file on the branch, when updating. */
  sha?: string | null;
  /** Existing PR number to reuse; a new PR is opened if omitted. */
  prNumber?: number | null;
  /** Staged images to upload to the branch before committing. */
  images?: Array<{ file: File; filename: string }>;
}

export interface PublishNoteResult {
  branch: string;
  /** Blob SHA of the committed file — pass back as `sha` on the next publish. */
  sha: string | null;
  commit: CommitInfo;
  /** The PR for this branch; `created` is false when an existing PR was reused. */
  pullRequest: PrInfo | null;
  createdPr: boolean;
}

/**
 * One-click publish: auto-branch off master (first time), upload staged
 * images, commit, and open a PR. Repeat publishes with the same branch/pr
 * update the existing PR instead of opening a new one.
 */
export async function publishNote(input: PublishNoteInput): Promise<PublishNoteResult> {
  const { slug, filename, images = [] } = input;

  // 1. Branch (once per session).
  let branch = input.branch || null;
  if (!branch) {
    branch = `${CMS_BRANCH_PREFIX}${slug}-${Date.now().toString(36)}`;
    await ensureCmsBranch(branch);
  }

  // 2. Upload any staged images to the branch.
  for (const img of images) {
    await uploadImage({
      file: img.file,
      slug,
      branch,
      filename: img.filename,
      message: `Add image for ${slug}`,
    }).catch((err) => {
      throw new Error(`Failed to upload image ${img.filename}: ${err.message}`);
    });
  }

  // 3. Commit the note.
  const commitData = await commit({
    content: input.content,
    filename,
    message: input.isUpdate ? `Update ${filename} via CMS` : `Create ${filename} via CMS`,
    branch,
    ...(input.sha ? { sha: input.sha } : {}),
  });

  // 4. Open the PR (once).
  if (!input.prNumber) {
    const prData = await createPr({
      title: `Add/Update: ${input.title || filename}`,
      body: input.description || 'Note updates via CMS',
      head: branch,
      base: DEFAULT_BRANCH,
    });
    return {
      branch,
      sha: commitData.content?.sha || null,
      commit: commitData.commit,
      pullRequest: prData.pullRequest,
      createdPr: true,
    };
  }

  return {
    branch,
    sha: commitData.content?.sha || null,
    commit: commitData.commit,
    pullRequest: null,
    createdPr: false,
  };
}

/**
 * Deletion follows the same one-click-PR flow as publishing: auto-branch off
 * master, remove the file, open a PR. Master is untouched until it's merged.
 */
export async function deleteNotePipeline(note: {
  filename: string;
  sha: string;
  slug: string;
  title: string;
}): Promise<PrInfo> {
  const branch = `${CMS_BRANCH_PREFIX}delete-${note.slug}-${Date.now().toString(36)}`;
  await ensureCmsBranch(branch);

  await deleteNote({
    filename: note.filename,
    sha: note.sha,
    branch,
    message: `Delete ${note.filename} via CMS`,
  });

  const prData = await createPr({
    title: `Delete: ${note.title}`,
    body: 'Note deletion via CMS',
    head: branch,
    base: DEFAULT_BRANCH,
  });

  return prData.pullRequest;
}
