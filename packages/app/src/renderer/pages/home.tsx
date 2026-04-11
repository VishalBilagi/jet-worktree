import { AddWorktreeDialog } from "@renderer/components/add-worktree-dialog"
import { CommandPalette } from "@renderer/components/command-palette"
import { GearSix, Plus } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { RepoTree } from "@renderer/components/repo-tree"
import { SettingsDialog } from "@renderer/components/settings-dialog"
import { TrackRepoDialog } from "@renderer/components/track-repo-dialog"
import { useRepos } from "@renderer/hooks/use-repos"
import { useAppStore } from "@renderer/lib/store"
import { Button } from "@renderer/components/ui/button"

export function HomePage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useRepos()
  const {
    isCommandPaletteOpen,
    isTrackDialogOpen,
    isSettingsDialogOpen,
    addWorktreeRepoPath,
    setCommandPaletteOpen,
    openCommandPalette,
    setTrackDialogOpen,
    setSettingsDialogOpen,
    openAddWorktreeDialog,
    closeAddWorktreeDialog,
  } = useAppStore()

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["repos"] })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.metaKey) {
        return
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandPaletteOpen(!isCommandPaletteOpen)
        return
      }

      if (event.key.toLowerCase() === "o") {
        event.preventDefault()
        openCommandPalette("open-github-repo")
        return
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault()
        openCommandPalette("open-ide-worktree")
        return
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault()
        openCommandPalette("open-terminal-worktree")
        return
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault()
        setCommandPaletteOpen(false)

        if (data?.repos[0]) {
          openAddWorktreeDialog(data.repos[0].rootPath)
        }

        return
      }

      if (event.key === ",") {
        event.preventDefault()
        setCommandPaletteOpen(false)
        setSettingsDialogOpen(true)
        return
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault()
        void queryClient.invalidateQueries({ queryKey: ["repos"] })
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [data?.repos, isCommandPaletteOpen, openAddWorktreeDialog, openCommandPalette, queryClient, setCommandPaletteOpen, setSettingsDialogOpen])

  const repoCount = data?.repos.length ?? 0
  const worktreeCount = data?.repos.reduce((count, repo) => count + repo.worktrees.length, 0) ?? 0
  const dirtyCount = data?.repos.reduce((count, repo) => count + repo.dirtyCount, 0) ?? 0

  const selectedRepo = data?.repos.find((repo) => repo.rootPath === addWorktreeRepoPath) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border px-5 pb-3.5 pt-12 sm:px-6 sm:pt-10" style={{ WebkitAppRegion: "drag" }}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pl-2 sm:pl-12">
          <div className="font-heading text-base font-bold uppercase tracking-[0.08em]">Jet</div>
          <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: "no-drag" }}>
            <Button variant="primary" onClick={() => setTrackDialogOpen(true)}>
              <Plus size={16} />
              Track Repo
            </Button>
            <Button size="icon" aria-label="Settings" onClick={() => setSettingsDialogOpen(true)}>
              <GearSix size={18} />
            </Button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 max-md:p-3">
        <div className="mx-auto w-full max-w-6xl">
          {isLoading ? <div className="grid min-h-[22rem] place-items-center border border-border px-6 text-center text-muted-foreground">Loading tracked repos...</div> : null}
          {error ? <div className="grid min-h-[22rem] place-items-center border border-border px-6 text-center text-status-error">{error.message}</div> : null}
          {!isLoading && !error && data ? <RepoTree repos={data.repos} onRefresh={refresh} onAddWorktree={openAddWorktreeDialog} /> : null}
        </div>
      </main>

      <footer className="shrink-0 border-t border-border px-5 py-3 text-[11px] text-subtle-foreground sm:px-6">
        <div className="mx-auto w-full max-w-6xl">{repoCount} repos · {worktreeCount} worktrees · {dirtyCount} dirty</div>
      </footer>

      <TrackRepoDialog open={isTrackDialogOpen} onClose={() => setTrackDialogOpen(false)} onTracked={refresh} />
      <AddWorktreeDialog open={Boolean(addWorktreeRepoPath)} repo={selectedRepo} onClose={closeAddWorktreeDialog} onCreated={refresh} />
      <SettingsDialog open={isSettingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
      <CommandPalette onRefresh={refresh} />
    </div>
  )
}
