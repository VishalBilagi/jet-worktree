import { access } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type InstalledApp = {
  id: string
  name: string
  appPath: string
  iconClass: string | null
}

export type AppCandidate = {
  id: string
  name: string
  appName: string
  iconClass: string | null
  bundleId?: string
}

export async function getInstalledApps(candidates: AppCandidate[]) {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const appPath = await detectApplication(candidate)
      if (!appPath) {
        return null
      }

      return {
        id: candidate.id,
        name: candidate.name,
        appPath,
        iconClass: candidate.iconClass,
      } satisfies InstalledApp
    }),
  )

  return results.filter((entry): entry is InstalledApp => entry !== null)
}

export async function openInstalledApp(apps: InstalledApp[], appId: string, targetPath: string, kindLabel: string) {
  const targetApp = apps.find((app) => app.id === appId)

  if (!targetApp) {
    return { ok: false as const, error: `${kindLabel} '${appId}' is not installed` }
  }

  return new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
    const child = spawn("open", ["-a", targetApp.appPath, targetPath], { stdio: "ignore" })
    child.on("error", (error) => resolve({ ok: false, error: error.message }))
    child.on("close", (code) => {
      if (code && code !== 0) {
        resolve({ ok: false, error: `${targetApp.name} exited with code ${code}` })
        return
      }

      resolve({ ok: true })
    })
  })
}

async function detectApplication(candidate: AppCandidate) {
  const appBundleName = `${candidate.appName}.app`
  const fallbackPaths = [
    path.join("/Applications", appBundleName),
    path.join(os.homedir(), "Applications", appBundleName),
    path.join("/Applications/Setapp", appBundleName),
  ]

  for (const candidatePath of fallbackPaths) {
    if (await exists(candidatePath)) {
      return candidatePath
    }
  }

  const query = candidate.bundleId
    ? `kMDItemCFBundleIdentifier == "${candidate.bundleId}"`
    : `kMDItemFSName == "${appBundleName}"`

  try {
    const { stdout } = await execFileAsync("mdfind", [query])
    const firstResult = stdout
      .split("\n")
      .map((entry) => entry.trim())
      .find(Boolean)

    return firstResult ?? null
  } catch {
    return null
  }
}

async function exists(pathname: string) {
  try {
    await access(pathname)
    return true
  } catch {
    return false
  }
}
