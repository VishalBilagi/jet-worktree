import { FormEvent, useEffect, useMemo, useState } from "react"
import { getJetBridge } from "@renderer/lib/bridge"
import type { BranchesPayload, RepoEntry } from "@renderer/lib/types"
import { Button } from "./ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command"
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
  const [branchData, setBranchData] = useState<BranchesPayload | null>(null)
  const [branchFilter, setBranchFilter] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const branchOptions = useMemo(() => {
    if (!branchData) {
      return []
    }

    return [...branchData.local, ...branchData.remote]
      .map((entry) => entry.name)
      .filter((value, index, all) => all.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b))
  }, [branchData])

  const filteredBranchOptions = useMemo(() => {
    if (!branchFilter.trim()) {
      return branchOptions.slice(0, 10)
    }

    const query = branchFilter.toLowerCase()
    return branchOptions
      .filter((name) => name.toLowerCase().includes(query))
      .slice(0, 10)
  }, [branchFilter, branchOptions])

  useEffect(() => {
    if (!open || !repo) {
      return
    }

    setLoadingBranches(true)
    setError(null)
    void getJetBridge()
      .listBranches(repo.rootPath)
      .then((result) => {
        if (!result.ok) {
          setError(result.error)
          return
        }

        setBranchData(result.data)
      })
      .catch((bridgeError) => {
        setError(bridgeError instanceof Error ? bridgeError.message : "Unable to load branches")
      })
      .finally(() => setLoadingBranches(false))
  }, [open, repo])

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
    setBranchFilter("")
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
            <Label htmlFor="worktree-branch">Checkout branch</Label>
            <Command className="rounded-md border border-border">
              <CommandInput
                id="worktree-branch"
                autoFocus
                value={branchFilter}
                onValueChange={setBranchFilter}
                placeholder={loadingBranches ? "Loading branches..." : "Search local + remote branches"}
              />
              <CommandList>
                <CommandEmpty>No matching branches</CommandEmpty>
                <CommandGroup heading="Top matches">
                  {filteredBranchOptions.map((name) => (
                    <CommandItem key={name} value={name} onSelect={(value) => {
                      setBranch(value)
                      setBranchFilter(value)
                    }}
                    >
                      {name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="worktree-branch-name">Worktree branch name</Label>
            <Input
              id="worktree-branch-name"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder="feature/new-branch"
            />
          </div>
          <p className="text-sm text-muted-foreground">Selecting branch <strong>B</strong> defaults this field to <strong>B</strong>. You can edit it before creating the worktree.</p>
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
