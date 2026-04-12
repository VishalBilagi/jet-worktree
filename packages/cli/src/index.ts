#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { Command } from "commander"
import { addTrackedRepo, getConfigPath, getWorktreeRoot, readConfig, removeTrackedRepo } from "./lib/config"
import { enterOrPrintTarget, resolveGoTarget, SelectionCancelledError } from "./lib/go"
import { ensureWorktree, ensureWorktreeFromPullRequest, ensureWorktreeWithOptions, listBranches, listTrackedRepos, listWorktrees, removeWorktreeByBranch, resolveRepo, resolveWorktreePath } from "./lib/git"
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
  .argument("[branch]")
  .option("--base <ref>", "Base ref used when creating a new branch (main|develop|current|<ref>)")
  .option("--pull-request <number>, --pr <number>", "Create a worktree from a pull request branch")
  .action(async (branch: string | undefined, options: { base?: string; pullRequest?: string; pr?: string }, command) => {
    const repo = await resolveRepo(getRepoPath(command))
    const pullRequestValue = options.pullRequest ?? options.pr

    if (pullRequestValue) {
      const prNumber = Number.parseInt(pullRequestValue, 10)
      if (Number.isNaN(prNumber) || prNumber <= 0) {
        throw new Error("Pull request number must be a positive integer")
      }

      const derivedBranch = branch?.trim() || `pr/${prNumber}`
      const worktreePath = await ensureWorktreeFromPullRequest(repo.rootPath, repo.repoSlug, prNumber, derivedBranch)
      outputResult(shouldOutputJson(command), {
        branch: derivedBranch,
        path: worktreePath,
        repoSlug: repo.repoSlug,
        created: true,
        pullRequest: prNumber,
      }, (data) => `Created ${data.branch} from PR #${data.pullRequest} at ${data.path}`)
      return
    }

    if (!branch && shouldOutputJson(command)) {
      throw new Error("Branch argument is required when using --json")
    }

    const branchMetadata = await listBranches(repo.rootPath)
    const resolvedBranch = branch?.trim() || await promptForBranch(branchMetadata)
    const branchAlreadyExists = hasKnownBranch(branchMetadata, resolvedBranch)
    const baseRef = options.base
      ? resolveBaseRef(options.base, branchMetadata)
      : (!branch && !branchAlreadyExists)
          ? await promptForBaseRef(branchMetadata, resolvedBranch)
          : null
    const chosenBase = branchAlreadyExists
      ? resolvedBranch
      : baseRef ?? "HEAD"

    const worktreeName = branch?.trim()
      ? resolvedBranch
      : await promptForWorktreeName(resolvedBranch)

    const worktreePath = baseRef
      ? await ensureWorktreeWithOptions(repo.rootPath, repo.repoSlug, worktreeName, { startPoint: baseRef })
      : await ensureWorktree(repo.rootPath, repo.repoSlug, worktreeName)

    outputResult(shouldOutputJson(command), {
      branch: worktreeName,
      path: worktreePath,
      repoSlug: repo.repoSlug,
      created: true,
      base: chosenBase,
    }, (data) => `Created ${data.branch} at ${data.path} (source: ${data.base})`)
  })

program
  .command("branches")
  .description("List local and remote branches for the current repo")
  .action(async (_args, command) => {
    const repo = await resolveRepo(getRepoPath(command))
    const branches = await listBranches(repo.rootPath)
    outputResult(shouldOutputJson(command), branches, (data) => {
      const locals = data.local.map((entry) => `  - ${entry.name}`).join("\n") || "  (none)"
      const remotes = data.remote.map((entry) => `  - ${entry.name}`).join("\n") || "  (none)"
      return [
        `Current: ${data.currentBranch ?? "detached"}`,
        `Default: ${data.defaultBranch ?? "unknown"}`,
        "",
        "Local",
        locals,
        "",
        "Remote (origin)",
        remotes,
      ].join("\n")
    })
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

const normalizedArgv = process.argv.map((arg) => arg === "-pr" ? "--pr" : arg)

program.parseAsync(normalizedArgv).catch((error: Error) => {
  if (error instanceof SelectionCancelledError) {
    process.exitCode = 0
    return
  }

  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})

function fuzzyScore(target: string, query: string) {
  if (!query.trim()) {
    return 1
  }

  const lowerTarget = target.toLowerCase()
  const lowerQuery = query.toLowerCase()

  if (lowerTarget.includes(lowerQuery)) {
    return 10 + lowerQuery.length
  }

  let queryIndex = 0
  let score = 0

  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i += 1) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      score += 1
      queryIndex += 1
    }
  }

  return queryIndex === lowerQuery.length ? score : -1
}

async function promptForBranch(branches: Awaited<ReturnType<typeof listBranches>>) {
  const combined = [...branches.local, ...branches.remote]
    .map((entry) => entry.name)
    .filter((value, index, arr) => arr.indexOf(value) === index)

  if (combined.length === 0) {
    throw new Error("No branches found in this repository")
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout })

  try {
    let query = ""

    while (true) {
      const candidates = combined
        .map((name) => ({ name, score: fuzzyScore(name, query) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 10)

      process.stdout.write("\nChoose an existing branch (or type a new one):\n")
      candidates.forEach((entry, index) => {
        process.stdout.write(`  ${index + 1}. ${entry.name}\n`)
      })

      const answer = (await readline.question("Filter (text), choose #, or type branch name directly: ")).trim()

      if (!answer) {
        if (candidates[0]) {
          return candidates[0].name
        }
        continue
      }

      if (/^\d+$/.test(answer)) {
        const selected = candidates[Number.parseInt(answer, 10) - 1]
        if (selected) {
          return selected.name
        }

        process.stdout.write("Invalid selection.\n")
        continue
      }

      if (combined.includes(answer)) {
        return answer
      }

      if (query === answer) {
        return answer
      }

      query = answer
    }
  } finally {
    readline.close()
  }
}

async function promptForWorktreeName(defaultBranch: string) {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await readline.question(`Worktree branch name [${defaultBranch}]: `)).trim()
    return answer || defaultBranch
  } finally {
    readline.close()
  }
}

function resolveBaseRef(base: string | undefined, branches: Awaited<ReturnType<typeof listBranches>>) {
  if (!base) {
    return null
  }

  if (base === "current") {
    return branches.currentBranch ?? "HEAD"
  }

  if (base === "main" || base === "develop") {
    return base
  }

  return base
}

function hasKnownBranch(branches: Awaited<ReturnType<typeof listBranches>>, branch: string) {
  return branches.local.some((entry) => entry.name === branch) || branches.remote.some((entry) => entry.name === branch)
}

async function promptForBaseRef(branches: Awaited<ReturnType<typeof listBranches>>, branchName: string) {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  const suggestedDefault = branches.defaultBranch ?? branches.currentBranch ?? "HEAD"
  const options = [
    { key: "1", label: `origin default (${suggestedDefault})`, value: suggestedDefault },
    { key: "2", label: "main", value: "main" },
    { key: "3", label: "develop", value: "develop" },
    { key: "4", label: `current (${branches.currentBranch ?? "HEAD"})`, value: branches.currentBranch ?? "HEAD" },
    { key: "5", label: "specific ref", value: "specific" },
  ]

  try {
    process.stdout.write(`\n'${branchName}' does not exist yet.\n`)
    process.stdout.write("Choose which ref to create it from:\n")
    options.forEach((entry) => {
      process.stdout.write(`  ${entry.key}. ${entry.label}\n`)
    })

    const selectedKey = (await readline.question("Base [1]: ")).trim() || "1"
    const selected = options.find((entry) => entry.key === selectedKey) ?? options[0]

    if (selected.value !== "specific") {
      return selected.value
    }

    const specificRef = (await readline.question("Git ref: ")).trim()
    return specificRef || "HEAD"
  } finally {
    readline.close()
  }
}
