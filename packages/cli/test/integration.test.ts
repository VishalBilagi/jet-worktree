import { beforeAll, describe, expect, test } from "bun:test"
import { execFile } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { randomUUID } from "node:crypto"

const execFileAsync = promisify(execFile)

const tempRepoParent = "/tmp/jet-worktree-tests"
const tempJetParent = "/tmp/.jet-worktree-tests"
const cliEntry = path.resolve(import.meta.dir, "../src/index.ts")

type TestContext = {
  repoRoot: string
  jetRoot: string
  configDir: string
  worktreeRoot: string
}

type JetSuccess = {
  exitCode: 0
  stdout: string
  stderr: string
  json: unknown
}

type JetFailure = {
  exitCode: number
  stdout: string
  stderr: string
}

async function runCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return execFileAsync(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
  })
}

async function runGit(args: string[], cwd: string) {
  return runCommand("git", ["-c", "commit.gpgsign=false", ...args], cwd, {
    GIT_TERMINAL_PROMPT: "0",
    SSH_ASKPASS: "",
    GIT_ASKPASS: "",
  })
}

async function runJet(args: string[], cwd: string, context: TestContext): Promise<JetSuccess> {
  try {
    const { stdout, stderr } = await runCommand(
      "bun",
      ["run", cliEntry, "--json", ...args],
      cwd,
      {
        JET_TEST_MODE: "1",
        JET_TEST_CONFIG_DIR: context.configDir,
        JET_TEST_WORKTREE_ROOT: context.worktreeRoot,
      },
    )

    return {
      exitCode: 0,
      stdout,
      stderr,
      json: JSON.parse(stdout),
    }
  } catch (error) {
    const failed = error as Error & {
      stdout?: string
      stderr?: string
      code?: number
    }

    throw {
      exitCode: failed.code ?? 1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? failed.message,
    } satisfies JetFailure
  }
}

async function runJetExpectFailure(args: string[], cwd: string, context: TestContext): Promise<JetFailure> {
  try {
    await runJet(args, cwd, context)
    throw new Error("Expected jet command to fail")
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    return error as JetFailure
  }
}

async function createRepo(context: TestContext, repoName: string, originUrl?: string) {
  await mkdir(context.repoRoot, { recursive: true })
  const repoPath = await mkdtemp(path.join(context.repoRoot, `${repoName}-`))
  const canonicalRepoPath = await realpath(repoPath)

  await runGit(["init", "-b", "main"], canonicalRepoPath)
  await runGit(["config", "user.name", "Jet Tests"], canonicalRepoPath)
  await runGit(["config", "user.email", "jet-tests@example.com"], canonicalRepoPath)

  if (originUrl) {
    await runGit(["remote", "add", "origin", originUrl], canonicalRepoPath)
  }

  await writeFile(path.join(canonicalRepoPath, "README.md"), `# ${repoName}\n`, "utf8")
  await runGit(["add", "README.md"], canonicalRepoPath)
  await runGit(["commit", "-m", "Initial commit"], canonicalRepoPath)

  return canonicalRepoPath
}

async function createBareRemote(context: TestContext, remoteName: string) {
  await mkdir(context.repoRoot, { recursive: true })
  const remotePath = path.join(context.repoRoot, `${remoteName}-${randomUUID()}.git`)
  await runCommand("git", ["init", "--bare", remotePath], context.repoRoot)
  return await realpath(remotePath)
}

async function fileExists(pathname: string) {
  try {
    await readFile(pathname)
    return true
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

async function canonicalPath(pathname: string) {
  try {
    return await realpath(pathname)
  } catch {
    return path.resolve(pathname)
  }
}

async function createTestContext(): Promise<TestContext> {
  await mkdir(tempRepoParent, { recursive: true })
  await mkdir(tempJetParent, { recursive: true })

  const repoRoot = await mkdtemp(path.join(tempRepoParent, "case-"))
  const jetRoot = await mkdtemp(path.join(tempJetParent, "case-"))
  const configDir = path.join(jetRoot, "config")
  const worktreeRoot = path.join(jetRoot, "worktrees")

  await mkdir(configDir, { recursive: true })
  await mkdir(worktreeRoot, { recursive: true })

  return {
    repoRoot,
    jetRoot,
    configDir,
    worktreeRoot,
  }
}

async function cleanupTestContext(context: TestContext) {
  await rm(context.repoRoot, { recursive: true, force: true })
  await rm(context.jetRoot, { recursive: true, force: true })
}

async function cleanupStaleTestRoots() {
  await rm(tempRepoParent, { recursive: true, force: true })
  await rm(tempJetParent, { recursive: true, force: true })
}

beforeAll(async () => {
  await cleanupStaleTestRoots()
})

describe("jet CLI integration", () => {
  test("adds and lists a worktree in isolated temp roots", async () => {
    const context = await createTestContext()
    const repoPath = await createRepo(context, "sample")

    try {
      const addResult = await runJet(["add", "feature/test"], repoPath, context)
      const addJson = addResult.json as { path: string; branch: string; repoSlug: string }

    expect(addJson.repoSlug).toBe(path.basename(repoPath))
    expect(addJson.branch).toBe("feature/test")
    expect(await canonicalPath(addJson.path)).toBe(await canonicalPath(path.join(context.worktreeRoot, path.basename(repoPath), "feature", "test")))
    expect(await pathExists(addJson.path)).toBe(true)

      const listResult = await runJet(["ls"], repoPath, context)
    const listJson = listResult.json as {
      repoSlug: string
      worktrees: Array<{ branch: string | null; path: string }>
    }

    expect(listJson.repoSlug).toBe(path.basename(repoPath))
    expect(listJson.worktrees).toHaveLength(2)
    expect(
      await Promise.all(
        listJson.worktrees.map(async (entry) => entry.branch === "feature/test" && (await canonicalPath(entry.path)) === (await canonicalPath(addJson.path))),
      ),
    ).toContain(true)
    } finally {
      await cleanupTestContext(context)
    }
  }, 20000)

  test("refuses to remove a dirty worktree without force and removes it with force", async () => {
    const context = await createTestContext()
    const repoPath = await createRepo(context, "dirty")

    try {
      const addResult = await runJet(["add", "feature/dirty"], repoPath, context)
    const addJson = addResult.json as { path: string }

    await writeFile(path.join(addJson.path, "dirty.txt"), "changed\n", "utf8")

      const failure = await runJetExpectFailure(["remove", "feature/dirty"], repoPath, context)
    expect(failure.stderr).toContain("has uncommitted changes")

      const removeResult = await runJet(["remove", "feature/dirty", "--force"], repoPath, context)
    const removeJson = removeResult.json as { removed: boolean; path: string }
    expect(removeJson.removed).toBe(true)
    expect(await pathExists(addJson.path)).toBe(false)
    } finally {
      await cleanupTestContext(context)
    }
  }, 20000)

  test("tracks repos and lists them without touching real home directories", async () => {
    const context = await createTestContext()
    const repoPath = await createRepo(context, "tracked")

    try {
      await runJet(["track", repoPath], repoPath, context)
      const configPath = path.join(context.configDir, "config.json")
    expect(await fileExists(configPath)).toBe(true)

      const reposResult = await runJet(["repos"], repoPath, context)
    const reposJson = reposResult.json as {
      repos: Array<{ rootPath: string; repoSlug: string }>
      errors: Array<{ rootPath: string; error: string }>
    }

    expect(reposJson.errors).toHaveLength(0)
    expect(reposJson.repos).toHaveLength(1)
    expect(reposJson.repos[0]?.rootPath).toBe(repoPath)
    expect(reposJson.repos[0]?.repoSlug).toBe(path.basename(repoPath))
    } finally {
      await cleanupTestContext(context)
    }
  }, 20000)

  test("reports missing tracked repos without crashing", async () => {
    const context = await createTestContext()
    const repoPath = await createRepo(context, "missing")

    try {
      await runJet(["track", repoPath], repoPath, context)
      await rm(repoPath, { recursive: true, force: true })

      const reposResult = await runJet(["repos"], context.repoRoot, context)
    const reposJson = reposResult.json as {
      repos: Array<unknown>
      errors: Array<{ rootPath: string; error: string }>
    }

    expect(reposJson.repos).toHaveLength(0)
    expect(reposJson.errors).toHaveLength(1)
    expect(reposJson.errors[0]?.rootPath).toBe(repoPath)
    } finally {
      await cleanupTestContext(context)
    }
  }, 20000)

  test("creates a worktree from a remote-only branch", async () => {
    const context = await createTestContext()
    const remotePath = await createBareRemote(context, "origin")
    const repoPath = await createRepo(context, "remote", remotePath)

    try {
      await runGit(["push", "-u", "origin", "main"], repoPath)
      await runGit(["checkout", "-b", "feature/remote-only"], repoPath)
      await writeFile(path.join(repoPath, "remote.txt"), "remote branch\n", "utf8")
      await runGit(["add", "remote.txt"], repoPath)
      await runGit(["commit", "-m", "Add remote branch"], repoPath)
      await runGit(["push", "-u", "origin", "feature/remote-only"], repoPath)
      await runGit(["checkout", "main"], repoPath)
      await runGit(["branch", "-D", "feature/remote-only"], repoPath)

      const addResult = await runJet(["add", "feature/remote-only"], repoPath, context)
    const addJson = addResult.json as { path: string }
    const branchName = (await runGit(["branch", "--show-current"], addJson.path)).stdout.trim()
    const remoteSlug = path.basename(remotePath, ".git")

    expect(branchName).toBe("feature/remote-only")
      expect(await canonicalPath(addJson.path)).toBe(
        await canonicalPath(path.join(context.worktreeRoot, path.basename(context.repoRoot), remoteSlug, "feature", "remote-only")),
      )
    } finally {
      await cleanupTestContext(context)
    }
  }, 30000)
})
