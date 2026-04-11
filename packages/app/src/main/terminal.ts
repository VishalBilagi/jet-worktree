import { spawn } from "node:child_process"
import path from "node:path"
import type { AppCandidate, InstalledApp } from "./apps"
import { getInstalledApps, openInstalledApp } from "./apps"

export type InstalledTerminal = InstalledApp

const terminalCandidates: AppCandidate[] = [
  { id: "terminal", name: "Terminal", appName: "Terminal", bundleId: "com.apple.Terminal", iconClass: null },
  { id: "iterm", name: "iTerm", appName: "iTerm", bundleId: "com.googlecode.iterm2", iconClass: null },
  { id: "ghostty", name: "Ghostty", appName: "Ghostty", bundleId: "com.mitchellh.ghostty", iconClass: null },
  { id: "warp", name: "Warp", appName: "Warp", iconClass: null },
  { id: "wezterm", name: "WezTerm", appName: "WezTerm", bundleId: "com.github.wez.wezterm", iconClass: null },
  { id: "kitty", name: "Kitty", appName: "kitty", bundleId: "net.kovidgoyal.kitty", iconClass: null },
  { id: "alacritty", name: "Alacritty", appName: "Alacritty", bundleId: "org.alacritty", iconClass: null },
  { id: "hyper", name: "Hyper", appName: "Hyper", bundleId: "co.zeit.hyper", iconClass: null },
  { id: "tabby", name: "Tabby", appName: "Tabby", iconClass: null },
  { id: "rio", name: "Rio", appName: "Rio", iconClass: null },
]

export async function getInstalledTerminals() {
  return getInstalledApps(terminalCandidates)
}

export async function openInTerminal(terminalId: string, targetPath: string) {
  const terminals = await getInstalledTerminals()
  const terminal = terminals.find((entry) => entry.id === terminalId)

  if (!terminal) {
    return { ok: false as const, error: `Terminal '${terminalId}' is not installed` }
  }

  if (terminal.id === "alacritty") {
    return new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
      const executablePath = path.join(terminal.appPath, "Contents", "MacOS", "alacritty")
      const child = spawn(executablePath, ["--working-directory", targetPath], { stdio: "ignore" })
      child.on("error", (error) => resolve({ ok: false, error: error.message }))
      child.on("close", (code) => {
        if (code && code !== 0) {
          resolve({ ok: false, error: `${terminal.name} exited with code ${code}` })
          return
        }

        resolve({ ok: true })
      })
    })
  }

  return openInstalledApp(terminals, terminalId, targetPath, "Terminal")
}
