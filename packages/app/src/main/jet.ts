import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
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

type JetCommand = {
  command: string
  args: string[]
  cwd?: string
}

function getJetCommand(): JetCommand {
  const bundledBinary = path.join(process.resourcesPath, "bin", "jet")

  if (existsSync(bundledBinary)) {
    return {
      command: bundledBinary,
      args: [],
    }
  }

  return {
    command: "bun",
    args: ["run", "jet", "--"],
    cwd: path.resolve(app.getAppPath(), "../.."),
  }
}

export function runJet(args: string[], cwd?: string) {
  return new Promise<JetResponse>((resolve) => {
    const jet = getJetCommand()
    const child = spawn(jet.command, [...jet.args, "--json", ...args], {
      cwd: cwd ?? jet.cwd,
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
