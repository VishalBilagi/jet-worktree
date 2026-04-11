import { spawn } from "node:child_process"
import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron"
import { getInstalledIdes, openInIde } from "./ide"
import { getInstalledTerminals, openInTerminal } from "./terminal"
import { runJet } from "./jet"

function normalizeGithubUrl(originUrl: string) {
  const normalizedOriginUrl = originUrl.trim()

  try {
    const url = new URL(normalizedOriginUrl)
    if (!url.hostname.includes("github.com")) {
      return null
    }

    const pathname = url.pathname.replace(/\.git$/, "")
    return `https://github.com${pathname}`
  } catch {
    const scpLike = normalizedOriginUrl.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^\s]+?)(?:\.git)?$/)
    if (!scpLike?.[1]) {
      return null
    }

    return `https://github.com/${scpLike[1]}`
  }
}

type JetConfigPayload = {
  configPath: string
  worktreeRoot: string
  trackedRepos: string[]
}

type JetReposPayload = {
  repos: Array<{
    rootPath: string
    worktrees: Array<{
      path: string
    }>
  }>
}

let mainWindow: BrowserWindow | null = null
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0A0A0A",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
    },
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"))
  }
}

async function requireTrackedWorktreePath(pathname: string) {
  const resolvedPath = await realpath(pathname)
  const stats = await stat(resolvedPath)

  if (!stats.isDirectory()) {
    throw new Error("Expected a directory path")
  }

  const reposResult = await runJet(["repos"])
  if (!reposResult.ok) {
    throw new Error(reposResult.error)
  }

  const data = reposResult.data as JetReposPayload
  const allowedPaths = await Promise.all(
    data.repos.flatMap((repo) => repo.worktrees.map(async (worktree) => realpath(worktree.path))),
  )

  if (!allowedPaths.includes(resolvedPath)) {
    throw new Error("Path is not a tracked worktree")
  }

  return resolvedPath
}

app.whenReady().then(() => {
  ipcMain.handle("jet:pick-repo", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Choose Repository Folder",
      buttonLabel: "Choose Repo",
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true as const, path: null }
    }

    return { ok: true as const, path: result.filePaths[0] ?? null }
  })
  ipcMain.handle("jet:get-config", async () => runJet(["config"]) as Promise<{ ok: true; data: JetConfigPayload } | { ok: false; error: string }>)
  ipcMain.handle("jet:list-repos", async () => runJet(["repos"]) as Promise<{ ok: true; data: JetReposPayload } | { ok: false; error: string }>)
  ipcMain.handle("jet:track-repo", async (_event, repoPath: string) => runJet(["track", repoPath]))
  ipcMain.handle("jet:untrack-repo", async (_event, repoPath: string) => runJet(["untrack", repoPath]))
  ipcMain.handle("jet:open-repo-github", async (_event, repoPath: string) => {
    return await new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
      const child = spawn("git", ["-C", repoPath, "config", "--get", "remote.origin.url"], { stdio: ["ignore", "pipe", "pipe"] })

      let stdout = ""
      let stderr = ""

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString()
      })

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString()
      })

      child.on("error", (error) => resolve({ ok: false, error: error.message }))
      child.on("close", async (code) => {
        if (code !== 0) {
          resolve({ ok: false, error: stderr.trim() || `git exited with code ${code}` })
          return
        }

        const githubUrl = normalizeGithubUrl(stdout)
        if (!githubUrl) {
          resolve({ ok: false, error: "Repo origin is not a GitHub remote" })
          return
        }

        try {
          await shell.openExternal(githubUrl)
          resolve({ ok: true })
        } catch (error) {
          resolve({ ok: false, error: error instanceof Error ? error.message : "Unable to open GitHub URL" })
        }
      })
    })
  })
  ipcMain.handle("jet:add-worktree", async (_event, repoPath: string, branch: string) => runJet(["--repo", repoPath, "add", branch]))
  ipcMain.handle("jet:remove-worktree", async (_event, repoPath: string, branch: string) => runJet(["--repo", repoPath, "remove", branch]))
  ipcMain.handle("jet:list-ides", async () => {
    const ides = await getInstalledIdes()
    return { ok: true as const, data: ides }
  })
  ipcMain.handle("jet:open-ide", async (_event, ideId: string, pathname: string) => {
    try {
      return await openInIde(ideId, await requireTrackedWorktreePath(pathname))
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unable to open path" }
    }
  })
  ipcMain.handle("jet:list-terminals", async () => {
    const terminals = await getInstalledTerminals()
    return { ok: true as const, data: terminals }
  })
  ipcMain.handle("jet:open-terminal-app", async (_event, terminalId: string, pathname: string) => {
    try {
      return await openInTerminal(terminalId, await requireTrackedWorktreePath(pathname))
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unable to open path" }
    }
  })
  ipcMain.handle("jet:open-terminal", async (_event, pathname: string) => {
    try {
      const resolvedPath = await requireTrackedWorktreePath(pathname)

      return await new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
        const child = spawn("open", ["-a", "Terminal", resolvedPath], { stdio: "ignore" })
        child.on("error", (error) => resolve({ ok: false, error: error.message }))
        child.on("close", (code) => {
          if (code && code !== 0) {
            resolve({ ok: false, error: `Terminal exited with code ${code}` })
            return
          }

          resolve({ ok: true })
        })
      })
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Unable to open path" }
    }
  })
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
