import { FormEvent, useMemo, useState } from "react"
import { getJetBridge } from "@renderer/lib/bridge"
import type { RepoEntry } from "@renderer/lib/types"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type AddWorktreeDialogProps = {
  open: boolean
  repo: RepoEntry | null
  onClose: () => void
  onCreated: () => void
}

export function AddWorktreeDialog({ open, repo, onClose, onCreated }: AddWorktreeDialogProps) {
  const [branch, setBranch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeholder = useMemo(() => {
    const branches = repo?.worktrees.map((worktree) => worktree.branch).filter(Boolean) ?? []
    return branches.find((value) => value !== "main") ? "feature/new-branch" : "feature/jet-foundation"
  }, [repo])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!repo) {
      setError("Repo not available")
      return
    }

    if (!branch.trim()) {
      setError("Branch name is required")
      return
    }

    setSubmitting(true)
    setError(null)

    let result
    try {
      result = await getJetBridge().addWorktree(repo.rootPath, branch.trim())
    } catch (bridgeError) {
      setSubmitting(false)
      setError(bridgeError instanceof Error ? bridgeError.message : "Jet bridge unavailable")
      return
    }

    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setBranch("")
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open && Boolean(repo)} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent aria-label="Add worktree">
        <DialogHeader>
          <div className="space-y-1 pr-10">
            <DialogTitle>Add Worktree</DialogTitle>
            <DialogDescription>Create a new worktree for {repo?.repoSlug}.</DialogDescription>
          </div>
        </DialogHeader>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="worktree-branch">Branch name</Label>
            <Input
              id="worktree-branch"
              autoFocus
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder={placeholder}
            />
          </div>
          <p className="text-sm text-muted-foreground">Jet will create the worktree under `~/.jet-worktrees/...` using this branch name.</p>
          {error ? <div className="text-sm text-status-error">{error}</div> : null}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>{submitting ? "Creating..." : "Create Worktree"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
