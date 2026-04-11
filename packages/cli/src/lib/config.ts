import { mkdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export type JetConfig = {
  trackedRepos: string[]
}

const defaultConfig: JetConfig = {
  trackedRepos: [],
}

function isTestMode() {
  return process.env.JET_TEST_MODE === "1"
}

function getTestConfigDirOverride() {
  if (!isTestMode()) {
    return null
  }

  return process.env.JET_TEST_CONFIG_DIR ?? null
}

function getTestWorktreeRootOverride() {
  if (!isTestMode()) {
    return null
  }

  return process.env.JET_TEST_WORKTREE_ROOT ?? null
}

export function getConfigDir() {
  const override = getTestConfigDirOverride()
  if (override) {
    return path.resolve(override)
  }

  return path.join(os.homedir(), ".config", "jet")
}

export function getConfigPath() {
  return path.join(getConfigDir(), "config.json")
}

export function getWorktreeRoot() {
  const override = getTestWorktreeRootOverride()
  if (override) {
    return path.resolve(override)
  }

  return path.join(os.homedir(), ".jet-worktrees")
}

export async function readConfig(): Promise<JetConfig> {
  try {
    const raw = await readFile(getConfigPath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<JetConfig>
    return {
      trackedRepos: normalizeRepoPaths(parsed.trackedRepos ?? []),
    }
  } catch {
    return defaultConfig
  }
}

export async function writeConfig(config: JetConfig) {
  await mkdir(getConfigDir(), { recursive: true })
  await writeFile(getConfigPath(), `${JSON.stringify({ trackedRepos: normalizeRepoPaths(config.trackedRepos) }, null, 2)}\n`, "utf8")
}

export async function addTrackedRepo(repoPath: string) {
  const config = await readConfig()
  const trackedRepos = normalizeRepoPaths([...config.trackedRepos, repoPath])
  await writeConfig({ trackedRepos })
  return trackedRepos
}

export async function removeTrackedRepo(repoPath: string) {
  const config = await readConfig()
  const target = path.resolve(repoPath)
  const trackedRepos = normalizeRepoPaths(config.trackedRepos.filter((entry) => path.resolve(entry) !== target))
  await writeConfig({ trackedRepos })
  return trackedRepos
}

export function normalizeRepoPaths(repoPaths: string[]) {
  return [...new Set(repoPaths.map((entry) => path.resolve(entry)))].sort((left, right) => left.localeCompare(right))
}
