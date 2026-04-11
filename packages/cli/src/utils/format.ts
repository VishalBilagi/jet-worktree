import chalk from "chalk"

export function formatRepoSummary(repo: { rootPath: string; repoSlug: string; worktreeCount: number; dirtyCount: number }) {
  return `${chalk.bold(repo.repoSlug)}\n${chalk.dim(repo.rootPath)}\n${repo.worktreeCount} worktrees, ${repo.dirtyCount} dirty`
}

export function formatPath(pathname: string) {
  return pathname
}

export function formatWorktreeList(data: {
  repoSlug: string
  rootPath: string
  worktrees: Array<{
    branch: string | null
    path: string
    isMain: boolean
    isCurrent: boolean
    dirty: boolean
    ahead: number
    behind: number
  }>
}) {
  const lines = [chalk.bold(data.repoSlug), chalk.dim(data.rootPath), ""]

  for (const worktree of data.worktrees) {
    const marker = worktree.dirty ? chalk.hex("#FB923C")("●") : chalk.hex("#4ADE80")("✓")
    const current = worktree.isCurrent ? chalk.cyan(" current") : ""
    const branch = worktree.branch ?? "detached"
    const aheadBehind = [
      worktree.ahead > 0 ? `↑${worktree.ahead}` : null,
      worktree.behind > 0 ? `↓${worktree.behind}` : null,
    ]
      .filter(Boolean)
      .join(" ")

    lines.push(`${marker} ${chalk.white(branch)}${current}${aheadBehind ? ` ${chalk.dim(aheadBehind)}` : ""}`)
    lines.push(`  ${chalk.dim(worktree.path)}${worktree.isMain ? chalk.dim(" [main]") : ""}`)
  }

  return lines.join("\n")
}

export function formatConfig(data: { configPath: string; worktreeRoot: string; trackedRepos: string[] }) {
  const lines = [chalk.bold("Jet config"), chalk.dim(data.configPath), "", `worktreeRoot: ${data.worktreeRoot}`, "trackedRepos:"]

  if (data.trackedRepos.length === 0) {
    lines.push("  (none)")
  } else {
    for (const repo of data.trackedRepos) {
      lines.push(`  - ${repo}`)
    }
  }

  return lines.join("\n")
}
