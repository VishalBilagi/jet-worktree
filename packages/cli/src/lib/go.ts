import { spawn } from "node:child_process"
import chalk from "chalk"
import process from "node:process"
import { readConfig } from "./config"
import { listTrackedRepos, listWorktrees, resolveRepo, type RepoListEntry, type WorktreeInfo } from "./git"

export type GoTarget = {
  repoRoot: string
  repoSlug: string
  branch: string | null
  path: string
}

export class SelectionCancelledError extends Error {
  constructor() {
    super("Cancelled")
    this.name = "SelectionCancelledError"
  }
}

export async function resolveGoTarget(cwd: string, branch?: string): Promise<GoTarget> {
  const repoContext = await tryResolveCurrentRepo(cwd)

  if (repoContext) {
    return branch
      ? pickBranchFromRepo(repoContext.repo.rootPath, repoContext.repo.repoSlug, repoContext.worktrees, branch)
      : pickWorktreeFromRepo(repoContext.repo.rootPath, repoContext.repo.repoSlug, repoContext.worktrees)
  }

  const config = await readConfig()
  const tracked = await listTrackedRepos(config.trackedRepos)

  if (tracked.repos.length === 0) {
    throw new Error("No tracked repos available")
  }

  if (branch) {
    const matches = tracked.repos
      .flatMap((repo) => repo.worktrees.map((worktree) => ({ repo, worktree })))
      .filter((entry) => entry.worktree.branch === branch)

    if (matches.length === 1) {
      const match = matches[0]
      if (!match) {
        throw new Error(`No worktree found for branch '${branch}'`)
      }

      return toGoTarget(match.repo, match.worktree)
    }

    if (matches.length > 1) {
      const match = await promptForChoice("Multiple repos contain that branch. Choose a worktree:", matches, (entry) => `${entry.repo.repoSlug} · ${entry.worktree.branch ?? "detached"}`)
      return toGoTarget(match.repo, match.worktree)
    }
  }

  const repo = await promptForChoice("Choose a tracked repo:", tracked.repos, (entry) => entry.repoSlug)
  return branch
    ? pickBranchFromRepo(repo.rootPath, repo.repoSlug, repo.worktrees, branch)
    : pickWorktreeFromRepo(repo.rootPath, repo.repoSlug, repo.worktrees)
}

export async function enterOrPrintTarget(target: GoTarget, printOnly: boolean) {
  if (printOnly || !process.stdin.isTTY || !process.stdout.isTTY) {
    process.stdout.write(`${target.path}\n`)
    return
  }

  const shell = process.env.SHELL
  if (!shell) {
    process.stdout.write(`${target.path}\n`)
    return
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(shell, {
      cwd: target.path,
      stdio: "inherit",
      env: process.env,
    })

    child.on("error", reject)
    child.on("exit", () => resolve())
  })
}

async function tryResolveCurrentRepo(cwd: string) {
  try {
    const repo = await resolveRepo(cwd)
    const { worktrees } = await listWorktrees(repo.rootPath)
    return { repo, worktrees }
  } catch {
    return null
  }
}

async function pickBranchFromRepo(repoRoot: string, repoSlug: string, worktrees: WorktreeInfo[], branch: string) {
  const target = worktrees.find((entry) => entry.branch === branch)
  if (!target) {
    throw new Error(`No worktree found for branch '${branch}'`)
  }

  return {
    repoRoot,
    repoSlug,
    branch: target.branch,
    path: target.path,
  }
}

async function pickWorktreeFromRepo(repoRoot: string, repoSlug: string, worktrees: WorktreeInfo[]) {
  const target = await promptForChoice(
    `Choose a worktree from ${repoSlug}:`,
    worktrees,
    (entry) => entry.branch ?? "detached",
  )

  return {
    repoRoot,
    repoSlug,
    branch: target.branch,
    path: target.path,
  }
}

async function promptForChoice<T>(message: string, options: T[], label: (option: T) => string) {
  if (options.length === 0) {
    throw new Error("No options available")
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive selection requires a TTY")
  }

  if (options.length === 1) {
    return options[0] as T
  }

  return promptWithKeyNavigation(message, options, label)
}

function toGoTarget(repo: RepoListEntry, worktree: WorktreeInfo): GoTarget {
  return {
    repoRoot: repo.rootPath,
    repoSlug: repo.repoSlug,
    branch: worktree.branch,
    path: worktree.path,
  }
}

async function promptWithKeyNavigation<T>(message: string, options: T[], label: (option: T) => string) {
  const stdin = process.stdin
  const stdout = process.stdout
  const linesRendered = { count: 0 }
  let selectedIndex = 0

  if (stdin.isTTY) {
    stdin.setRawMode(true)
  }
  stdin.resume()

  const render = () => {
    clearRenderedLines(linesRendered.count)

    const lines = [
      `${chalk.bold(message)}`,
      `${chalk.dim("Press Enter to confirm, q to cancel.")}`,
      "",
      ...options.map((option, index) => {
        const isSelected = index === selectedIndex
        const prefix = isSelected ? chalk.cyan("›") : chalk.dim(" ")
        const colorizedLabel = isSelected ? chalk.cyanBright(label(option)) : chalk.white(label(option))
        return `${prefix} ${colorizedLabel}`
      }),
    ]

    stdout.write(`${lines.join("\n")}\n`)
    linesRendered.count = lines.length
  }

  render()

  try {
    return await new Promise<T>((resolve, reject) => {
      const onData = (chunk: Buffer | string) => {
        const input = typeof chunk === "string" ? chunk : chunk.toString("utf8")

        if (input === "\u001b[A" || input === "k") {
          selectedIndex = selectedIndex === 0 ? options.length - 1 : selectedIndex - 1
          render()
          return
        }

        if (input === "\u001b[B" || input === "j") {
          selectedIndex = selectedIndex === options.length - 1 ? 0 : selectedIndex + 1
          render()
          return
        }

        if (input === "\r" || input === "\n") {
          const choice = options[selectedIndex]
          cleanup()
          if (!choice) {
            reject(new Error("No option selected"))
            return
          }

          resolve(choice)
          return
        }

        if (input === "q" || input === "\u001b" || input === "\u0003") {
          cleanup()
          reject(new Error("Selection cancelled"))
        }
      }

      const cleanup = () => {
        stdin.off("data", onData)
        if (stdin.isTTY) {
          stdin.setRawMode(false)
        }
        stdin.pause()
        clearRenderedLines(linesRendered.count)
        stdout.write("\n")
      }

      stdin.on("data", onData)
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Selection cancelled") {
      throw new SelectionCancelledError()
    }

    throw error
  }
}

function clearRenderedLines(count: number) {
  if (count === 0) {
    return
  }

  for (let index = 0; index < count; index += 1) {
    process.stdout.moveCursor?.(0, -1)
    process.stdout.clearLine?.(0)
  }
  process.stdout.cursorTo?.(0)
}
