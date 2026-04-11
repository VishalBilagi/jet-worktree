export type Worktree = {
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

export type RepoEntry = {
  rootPath: string
  repoSlug: string
  dirtyCount: number
  worktrees: Worktree[]
}

export type ReposPayload = {
  repos: RepoEntry[]
}

export type InstalledIde = {
  id: string
  name: string
  appPath: string
  iconClass: string | null
}

export type InstalledTerminal = {
  id: string
  name: string
  appPath: string
  iconClass: string | null
}

declare global {
  interface Window {
    jet?: {
      pickRepo: () => Promise<{ ok: true; path: string | null } | { ok: false; error: string }>
      getConfig: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
      listRepos: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
      trackRepo: (repoPath: string) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
      untrackRepo: (repoPath: string) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
      openRepoGithub: (repoPath: string) => Promise<{ ok: true } | { ok: false; error: string }>
      addWorktree: (repoPath: string, branch: string) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
      removeWorktree: (repoPath: string, branch: string) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>
      listIdes: () => Promise<{ ok: true; data: InstalledIde[] } | { ok: false; error: string }>
      openIde: (ideId: string, pathname: string) => Promise<{ ok: true } | { ok: false; error: string }>
      listTerminals: () => Promise<{ ok: true; data: InstalledTerminal[] } | { ok: false; error: string }>
      openTerminalApp: (terminalId: string, pathname: string) => Promise<{ ok: true } | { ok: false; error: string }>
      openTerminal: (pathname: string) => Promise<{ ok: true } | { ok: false; error: string }>
      onRefresh: (callback: () => void) => () => void
    }
  }
}
