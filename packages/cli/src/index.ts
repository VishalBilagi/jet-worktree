#!/usr/bin/env node
import { spawn } from "node:child_process"
import { Command } from "commander"
import { addTrackedRepo, getConfigPath, getWorktreeRoot, readConfig, removeTrackedRepo } from "./lib/config"
import { enterOrPrintTarget, resolveGoTarget, SelectionCancelledError } from "./lib/go"
import { ensureWorktree, listTrackedRepos, listWorktrees, removeWorktreeByBranch, resolveRepo, resolveWorktreePath } from "./lib/git"
import { formatConfig, formatPath, formatRepoSummary, formatWorktreeList } from "./utils/format"
import { outputResult, printJson } from "./utils/json"

type CommandOptions = {
  json?: boolean
  force?: boolean
  path?: string
  repo?: string
  print?: boolean
}

const program = new Command()

program
  .name("jet")
  .description("Opinionated git worktree management")
  .option("--json", "Output machine-readable JSON")
  .option("--repo <path>", "Run the command against a specific repo path")

function getRepoPath(command: Command) {
  void command
  const opts = program.opts<{ repo?: string }>()
  return opts?.repo ?? process.cwd()
}

function shouldOutputJson(command: Command) {
  void command
  const opts = program.opts<{ json?: boolean }>()
  return Boolean(opts.json)
}

program
  .command("ls")
  .alias("list")
  .description("List worktrees for the current repo")
  .action(async (_args, command) => {
    const data = await listWorktrees(getRepoPath(command))
    outputResult(shouldOutputJson(command), {
      repoSlug: data.repo.repoSlug,
      rootPath: data.repo.rootPath,
      worktrees: data.worktrees,
    }, formatWorktreeList)
  })

program
  .command("status")
  .description("Show repo summary and worktree status")
  .action(async (_args, command) => {
    const data = await listWorktrees(getRepoPath(command))
    const summary = {
      rootPath: data.repo.rootPath,
      repoSlug: data.repo.repoSlug,
      worktreeCount: data.worktrees.length,
      dirtyCount: data.worktrees.filter((entry) => entry.dirty).length,
      worktrees: data.worktrees,
    }

    if (shouldOutputJson(command)) {
      printJson(summary)
      return
    }

    process.stdout.write(`${formatRepoSummary(summary)}\n\n${formatWorktreeList({
      repoSlug: data.repo.repoSlug,
      rootPath: data.repo.rootPath,
      worktrees: data.worktrees,
    })}\n`)
  })

program
  .command("add")
  .description("Create a worktree for a branch")
  .argument("<branch>")
  .action(async (branch: string, command) => {
    const repo = await resolveRepo(getRepoPath(command))
    const worktreePath = await ensureWorktree(repo.rootPath, repo.repoSlug, branch)
    outputResult(shouldOutputJson(command), {
      branch,
      path: worktreePath,
      repoSlug: repo.repoSlug,
      created: true,
    }, (data) => `Created ${data.branch} at ${data.path}`)
  })

program
  .command("open")
  .description("Open a worktree in Visual Studio Code")
  .argument("<branch>")
  .action(async (branch: string, command) => {
    const repo = await resolveRepo(getRepoPath(command))
    const worktreePath = await ensureWorktree(repo.rootPath, repo.repoSlug, branch)

    if (!shouldOutputJson(command)) {
      spawn("code", [worktreePath], { stdio: "ignore", detached: true }).unref()
    }

    outputResult(shouldOutputJson(command), {
      branch,
      path: worktreePath,
      opened: true,
    }, (data) => `Opened ${data.branch} at ${data.path}`)
  })

program
  .command("remove")
  .description("Remove a worktree by branch")
  .argument("<branch>")
  .option("--force", "Remove dirty worktrees")
  .action(async (branch: string, options: CommandOptions, command) => {
    const repo = await resolveRepo(getRepoPath(command))
    const removedPath = await removeWorktreeByBranch(repo.rootPath, branch, Boolean(options.force))
    outputResult(shouldOutputJson(command), {
      branch,
      path: removedPath,
      removed: true,
    }, (data) => `Removed ${data.branch} at ${data.path}`)
  })

program
  .command("path")
  .description("Print the expected worktree path")
  .argument("<branch>")
  .action(async (branch: string, command) => {
    const repo = await resolveRepo(getRepoPath(command))
    outputResult(shouldOutputJson(command), {
      branch,
      path: resolveWorktreePath(repo.repoSlug, branch),
    }, (data) => formatPath(data.path))
  })

program
  .command("go")
  .description("Jump into a worktree or print its path")
  .argument("[branch]", "Branch name to jump to")
  .option("--print", "Print the resolved path instead of opening a shell there")
  .action(async (branch: string | undefined, options: CommandOptions, command) => {
    const target = await resolveGoTarget(getRepoPath(command), branch)

    if (shouldOutputJson(command)) {
      printJson(target)
      return
    }

    await enterOrPrintTarget(target, Boolean(options.print))
  })

program
  .command("config")
  .description("Show Jet config")
  .action(async (_args, command) => {
    const config = await readConfig()
    outputResult(shouldOutputJson(command), {
      configPath: getConfigPath(),
      worktreeRoot: getWorktreeRoot(),
      trackedRepos: config.trackedRepos,
    }, formatConfig)
  })

program
  .command("track")
  .description("Track an existing repo in Jet app config")
  .argument("[repoPath]", "Repo path to track", process.cwd())
  .action(async (repoPath: string, command) => {
    const repo = await resolveRepo(repoPath)
    const trackedRepos = await addTrackedRepo(repo.rootPath)
    outputResult(shouldOutputJson(command), {
      tracked: repo.rootPath,
      trackedRepos,
    }, (data) => `Tracked ${data.tracked}`)
  })

program
  .command("untrack")
  .description("Untrack a repo from Jet app config")
  .argument("[repoPath]", "Repo path to untrack", process.cwd())
  .action(async (repoPath: string, command) => {
    const repo = await resolveRepo(repoPath)
    const trackedRepos = await removeTrackedRepo(repo.rootPath)
    outputResult(shouldOutputJson(command), {
      untracked: repo.rootPath,
      trackedRepos,
    }, (data) => `Untracked ${data.untracked}`)
  })

program
  .command("repos")
  .description("List tracked repos with worktrees for the app")
  .action(async (_args, command) => {
    const config = await readConfig()
    const result = await listTrackedRepos(config.trackedRepos)

    outputResult(shouldOutputJson(command), result, (data) => {
      if (data.repos.length === 0) {
        return data.errors.length > 0 ? data.errors.map((entry) => `${entry.rootPath}: ${entry.error}`).join("\n") : "No tracked repos"
      }

      return data.repos
        .map((repo) => `${repo.repoSlug}\n${repo.worktrees.map((worktree) => `  - ${worktree.branch ?? "detached"} (${worktree.path})`).join("\n")}`)
        .join("\n\n")
    })
  })

program.parseAsync(process.argv).catch((error: Error) => {
  if (error instanceof SelectionCancelledError) {
    process.exitCode = 0
    return
  }

  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
