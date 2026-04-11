import { spawn } from "node:child_process"
import path from "node:path"
import { app } from "electron"

type JetSuccess = {
  ok: true
  data: unknown
}

type JetFailure = {
  ok: false
  error: string
}

export type JetResponse = JetSuccess | JetFailure

function getWorkspaceRoot() {
  return path.resolve(app.getAppPath(), "../..")
}

export function runJet(args: string[], cwd = getWorkspaceRoot()) {
  return new Promise<JetResponse>((resolve) => {
    const child = spawn("bun", ["run", "jet", "--", "--json", ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: stderr.trim() || `jet exited with code ${code}` })
        return
      }

      try {
        resolve({ ok: true, data: JSON.parse(stdout) })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to parse Jet output"
        resolve({ ok: false, error: message })
      }
    })
  })
}
