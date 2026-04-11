import { useState } from "react"
import { Check, Circle, FolderSimple, Plus, Trash } from "@phosphor-icons/react"
import { getJetBridge } from "@renderer/lib/bridge"
import type { RepoEntry, Worktree } from "@renderer/lib/types"
import { useIdes } from "@renderer/hooks/use-ides"
import { useTerminals } from "@renderer/hooks/use-terminals"
import { OpenMenu, OpenTextMenu } from "./open-menu"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader } from "./ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"

type RepoTreeProps = {
  repos: RepoEntry[]
  onRefresh: () => void
  onAddWorktree: (repoPath: string) => void
}

type ActionResult = { ok: true; data: unknown } | { ok: false; error: string }

type RemoveCandidate = {
  repoPath: string
  branch: string
  worktreePath: string
}

async function runAction(action: () => Promise<ActionResult>, onRefresh: () => void) {
  let result
  try {
    result = await action()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Jet bridge unavailable")
    return
  }

  if (!result.ok) {
    window.alert(result.error)
    return
  }
  onRefresh()
}

function worktreeSuffix(worktree: Worktree) {
  const parts = []
  if (worktree.dirty) {
    parts.push("dirty")
  }
  if (worktree.ahead > 0) {
    parts.push(`↑${worktree.ahead}`)
  }
  if (worktree.behind > 0) {
    parts.push(`↓${worktree.behind}`)
  }
  return parts.join(" ")
}

function WorktreeRow({
  repo,
  worktree,
  isLast,
  onRefresh,
  ides,
  isIdeLoading,
  terminals,
  isTerminalLoading,
  onRequestRemove,
}: {
  repo: RepoEntry
  worktree: Worktree
  isLast: boolean
  onRefresh: () => void
  ides: ReturnType<typeof useIdes>["data"]
  isIdeLoading: boolean
  terminals: ReturnType<typeof useTerminals>["data"]
  isTerminalLoading: boolean
  onRequestRemove: (candidate: RemoveCandidate) => void
}) {
  const branch = worktree.branch ?? "detached"
  return (
    <div className="group grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border-subtle px-5 py-2.5 text-sm hover:bg-hover max-md:grid-cols-[minmax(0,1fr)_auto] max-md:px-4 last:border-b-0">
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-muted-foreground">{isLast ? "└──" : "├──"}</span>
        <span className="truncate">{branch}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {worktree.dirty ? <Circle size={10} weight="fill" className="text-status-dirty" /> : <Check size={14} className="text-status-clean" />}
        <span className="text-muted-foreground">{worktreeSuffix(worktree)}</span>
      </div>
      <div className="hidden gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto md:flex">
        <OpenMenu worktreePath={worktree.path} ides={ides ?? []} terminals={terminals ?? []} isIdeLoading={isIdeLoading} isTerminalLoading={isTerminalLoading} />
        {!worktree.isMain ? (
          <Button
            variant="danger"
            size="icon"
            type="button"
            onClick={() => onRequestRemove({ repoPath: repo.rootPath, branch, worktreePath: worktree.path })}
            title="Remove worktree"
          >
            <Trash size={18} />
          </Button>
        ) : null}
      </div>
      <div className="col-span-full -mt-1 pl-7 text-xs text-muted-foreground">{worktree.path}</div>
      <div className="md:hidden">
        <OpenTextMenu worktreePath={worktree.path} ides={ides ?? []} terminals={terminals ?? []} isIdeLoading={isIdeLoading} isTerminalLoading={isTerminalLoading} />
      </div>
    </div>
  )
}

function RemoveWorktreeDialog({
  candidate,
  onClose,
  onConfirm,
}: {
  candidate: RemoveCandidate | null
  onClose: () => void
  onConfirm: () => void
}) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!candidate) {
      return
    }

    setIsRemoving(true)
    setError(null)

    try {
      const result = await getJetBridge().removeWorktree(candidate.repoPath, candidate.branch)
      if (!result.ok) {
        setError(result.error)
        setIsRemoving(false)
        return
      }

      setIsRemoving(false)
      onConfirm()
      onClose()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Jet bridge unavailable")
      setIsRemoving(false)
    }
  }

  return (
    <Dialog
      open={Boolean(candidate)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isRemoving) {
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent aria-label="Remove worktree">
        <DialogHeader>
          <div className="space-y-1 pr-10">
            <DialogTitle>Remove Worktree</DialogTitle>
            <DialogDescription>This will remove the selected worktree from Jet.</DialogDescription>
          </div>
        </DialogHeader>
        {candidate ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="border border-border bg-background px-3 py-3">
              <div className="font-heading text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Branch</div>
              <div className="mt-1 text-sm text-foreground">{candidate.branch}</div>
            </div>
            <div className="border border-border bg-background px-3 py-3">
              <div className="font-heading text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Worktree Path</div>
              <div className="mt-1 break-all text-sm text-foreground">{candidate.worktreePath}</div>
            </div>
            <p className="text-sm text-muted-foreground">If the worktree has uncommitted changes, Jet will block the removal.</p>
            {error ? <div className="text-sm text-status-error">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" onClick={onClose} disabled={isRemoving}>Cancel</Button>
              <Button type="button" variant="danger" onClick={() => void handleConfirm()} disabled={isRemoving}>
                {isRemoving ? "Removing..." : "Remove Worktree"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RepoRow({ repo, onRefresh, onAddWorktree }: { repo: RepoEntry; onRefresh: () => void; onAddWorktree: (repoPath: string) => void }) {
  const { data: ides, isLoading: isIdeLoading } = useIdes()
  const { data: terminals, isLoading: isTerminalLoading } = useTerminals()
  const [removeCandidate, setRemoveCandidate] = useState<RemoveCandidate | null>(null)

  return (
    <>
      <Card className="w-full max-w-5xl">
        <CardHeader className="flex min-h-14 flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <FolderSimple size={18} className="text-accent" />
            <div>
              <div className="font-heading text-[13px] font-semibold">{repo.repoSlug}</div>
              <div className="text-xs text-muted-foreground">{repo.rootPath}</div>
            </div>
          </div>
          <Button onClick={() => onAddWorktree(repo.rootPath)}>
            <Plus size={16} />
            Worktree
          </Button>
        </CardHeader>
        <CardContent>
          {repo.worktrees.map((worktree, index) => (
            <div key={worktree.path}>
              <WorktreeRow
                repo={repo}
                worktree={worktree}
                isLast={index === repo.worktrees.length - 1}
                onRefresh={onRefresh}
                ides={ides}
                isIdeLoading={isIdeLoading}
                terminals={terminals}
                isTerminalLoading={isTerminalLoading}
                onRequestRemove={setRemoveCandidate}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <RemoveWorktreeDialog candidate={removeCandidate} onClose={() => setRemoveCandidate(null)} onConfirm={onRefresh} />
    </>
  )
}

export function RepoTree({ repos, onRefresh, onAddWorktree }: RepoTreeProps) {
  if (repos.length === 0) {
    return (
      <div className="grid min-h-[22rem] place-items-center border border-border px-6 text-center text-muted-foreground">
        <div>
          <div className="font-heading text-lg text-foreground">No repos tracked yet</div>
          <div className="mt-2 text-sm">Use the Track Repo action above to add an existing git repo.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {repos.map((repo) => (
        <RepoRow key={repo.rootPath} repo={repo} onRefresh={onRefresh} onAddWorktree={onAddWorktree} />
      ))}
    </div>
  )
}
