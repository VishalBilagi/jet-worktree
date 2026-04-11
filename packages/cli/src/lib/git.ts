import { access } from "node:fs/promises"
import path from "node:path"
import { simpleGit, type SimpleGit } from "simple-git"
import { getWorktreeRoot } from "./config"

export type RepoInfo = {
  rootPath: string
  repoSlug: string
  originUrl: string | null
}

export type WorktreeInfo = {
  path: string
  branch: string | null
  isMain: boolean
  isCurrent: boolean
  locked: boolean
  prunable: boolean
  dirty: boolean
  ahead: number
  behind: number
}

export type RepoListEntry = {
  rootPath: string
  repoSlug: string
  dirtyCount: number
  worktrees: WorktreeInfo[]
}

export type RepoListError = {
  rootPath: string
  error: string
}

type RawWorktreeEntry = {
  path: string
  branch: string | null
  bare: boolean
  detached: boolean
  locked: boolean
  prunable: boolean
}

export function createGit(cwd = process.cwd()) {
  return simpleGit({ baseDir: cwd, binary: "git", trimmed: true })
}

export async function resolveRepo(cwd = process.cwd()): Promise<RepoInfo> {
  const git = createGit(cwd)
  const rootPath = await git.revparse(["--show-toplevel"])
  const originUrl = await getOriginUrl(git)
  const repoSlug = deriveRepoSlug(rootPath, originUrl)

  return {
    rootPath,
    repoSlug,
    originUrl,
  }
}

export function deriveRepoSlug(rootPath: string, originUrl: string | null) {
  if (!originUrl) {
    return path.basename(rootPath)
  }

  const normalizedOriginUrl = originUrl.trim()

  try {
    const url = new URL(normalizedOriginUrl)
    return sanitizeRepoSlug(url.pathname.replace(/^\//, "")) || path.basename(rootPath)
  } catch {
    // Fall through to SCP-like parsing below.
  }

  const scpLike = normalizedOriginUrl.match(/[:/]([^/:]+\/[^/]+)$/)
  if (scpLike?.[1]) {
    return sanitizeRepoSlug(scpLike[1]) || path.basename(rootPath)
  }

  return path.basename(rootPath)
}

export function resolveWorktreePath(repoSlug: string, branch: string) {
  return path.join(getWorktreeRoot(), repoSlug, branch)
}

export async function listWorktrees(cwd = process.cwd()): Promise<{ repo: RepoInfo; worktrees: WorktreeInfo[] }> {
  const repo = await resolveRepo(cwd)
  const git = createGit(repo.rootPath)
  const raw = await git.raw(["worktree", "list", "--porcelain", "-z"])
  const entries = parseWorktreeList(raw)
  const currentRoot = repo.rootPath
  const worktrees = (await Promise.all(
    entries.map(async (entry) => {
      const exists = await pathExists(entry.path)
      if (!exists) {
        return null
      }

      const branch = entry.branch?.replace("refs/heads/", "") ?? null
      const worktreeGit = createGit(entry.path)
      const status = await worktreeGit.status()

      return {
        path: entry.path,
        branch,
        isMain: entry.path === currentRoot,
        isCurrent: entry.path === currentRoot,
        locked: entry.locked,
        prunable: entry.prunable,
        dirty: !status.isClean(),
        ahead: status.ahead,
        behind: status.behind,
      }
    }),
  )).filter((entry): entry is WorktreeInfo => entry !== null)

  return {
    repo,
    worktrees,
  }
}

export function parseWorktreeList(raw: string): RawWorktreeEntry[] {
  const lines = raw.includes("\u0000") ? raw.split("\u0000") : raw.split("\n")
  const entries: RawWorktreeEntry[] = []
  let current: RawWorktreeEntry | null = null

  for (const line of lines) {
    if (!line) {
      if (current) {
        entries.push(current)
        current = null
      }
      continue
    }

    const [key, ...rest] = line.split(" ")
    const value = rest.join(" ")

    if (key === "worktree") {
      current = {
        path: value,
        branch: null,
        bare: false,
        detached: false,
        locked: false,
        prunable: false,
      }
      continue
    }

    if (!current) {
      continue
    }

    if (key === "branch") current.branch = value
    if (key === "bare") current.bare = true
    if (key === "detached") current.detached = true
    if (key === "locked") current.locked = true
    if (key === "prunable") current.prunable = true
  }

  if (current) {
    entries.push(current)
  }

  return entries
}

export async function ensureWorktree(repoRoot: string, repoSlug: string, branch: string) {
  const desiredPath = resolveWorktreePath(repoSlug, branch)
  const repoGit = createGit(repoRoot)
  await repoGit.raw(["worktree", "prune"])
  const { worktrees } = await listWorktrees(repoRoot)
  const existing = worktrees.find((entry) => entry.branch === branch)

  if (existing) {
    return existing.path
  }

  const git = repoGit
  const localExists = await branchExists(git, branch)
  const remoteExists = await remoteBranchExists(git, branch)

  if (localExists) {
    await git.raw(["worktree", "add", desiredPath, branch])
    return desiredPath
  }

  if (remoteExists) {
    await git.raw(["worktree", "add", "-b", branch, desiredPath, `origin/${branch}`])
    return desiredPath
  }

  await git.raw(["worktree", "add", "-b", branch, desiredPath, "HEAD"])
  return desiredPath
}

export async function removeWorktreeByBranch(repoRoot: string, branch: string, force = false) {
  const { worktrees } = await listWorktrees(repoRoot)
  const target = worktrees.find((entry) => entry.branch === branch)
  if (!target) {
    throw new Error(`No worktree found for branch '${branch}'`)
  }

  if (target.isMain) {
    throw new Error("Refusing to remove the main repository worktree")
  }

  if (target.dirty && !force) {
    throw new Error(`Worktree '${branch}' has uncommitted changes. Re-run with --force to remove it.`)
  }

  const git = createGit(repoRoot)
  const args = ["worktree", "remove"]
  if (force) {
    args.push("--force")
  }
  args.push(target.path)
  await git.raw(args)
  await git.raw(["worktree", "prune"])

  return target.path
}

async function getOriginUrl(git: SimpleGit) {
  try {
    return (await git.remote(["get-url", "origin"]))?.trim() ?? null
  } catch {
    return null
  }
}

function sanitizeRepoSlug(value: string) {
  return value.trim().replace(/\.git$/, "").replace(/^\/+/, "").replace(/\?+$/, "")
}

export async function listTrackedRepos(repoPaths: string[]) {
  const results = await Promise.all(
    repoPaths.map(async (repoPath) => {
      try {
        const data = await listWorktrees(repoPath)
        const repo: RepoListEntry = {
          rootPath: data.repo.rootPath,
          repoSlug: data.repo.repoSlug,
          dirtyCount: data.worktrees.filter((entry) => entry.dirty).length,
          worktrees: data.worktrees,
        }

        return { ok: true as const, repo }
      } catch (error) {
        const failure: RepoListError = {
          rootPath: repoPath,
          error: error instanceof Error ? error.message : "Unknown error",
        }

        return { ok: false as const, failure }
      }
    }),
  )

  return {
    repos: results.filter((result) => result.ok).map((result) => result.repo),
    errors: results.filter((result) => !result.ok).map((result) => result.failure),
  }
}

async function branchExists(git: SimpleGit, branch: string) {
  try {
    await git.revparse(["--verify", branch])
    return true
  } catch {
    return false
  }
}

async function remoteBranchExists(git: SimpleGit, branch: string) {
  try {
    const output = await git.raw(["ls-remote", "--heads", "origin", branch])
    return output.trim().length > 0
  } catch {
    return false
  }
}

async function pathExists(pathname: string) {
  try {
    await access(pathname)
    return true
  } catch {
    return false
  }
}
