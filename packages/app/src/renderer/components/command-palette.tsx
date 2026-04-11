import { useEffect, useMemo, useState } from "react"
import {
  ArrowsClockwise,
  ArrowSquareOut,
  CaretLeft,
  Code,
  Copy,
  FolderMinus,
  FolderPlus,
  GearSix,
  GithubLogo,
  GitBranch,
  Terminal,
  Trash,
} from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useIdes } from "@renderer/hooks/use-ides"
import { useRepos } from "@renderer/hooks/use-repos"
import { useTerminals } from "@renderer/hooks/use-terminals"
import { getJetBridge, getJetBridgeMethod } from "@renderer/lib/bridge"
import { useAppStore } from "@renderer/lib/store"
import type { InstalledIde, InstalledTerminal, RepoEntry, Worktree } from "@renderer/lib/types"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./ui/command"

type CommandPaletteProps = {
  onRefresh: () => void
}

type PalettePage =
  | "root"
  | "add-worktree-repo"
  | "remove-worktree"
  | "open-ide-worktree"
  | "open-ide-app"
  | "open-terminal-worktree"
  | "open-terminal-app"
  | "open-github-repo"
  | "go-to-worktree"
  | "copy-worktree-path"
  | "untrack-repo"

type WorktreeItem = {
  repo: RepoEntry
  worktree: Worktree
  branchLabel: string
  searchLabel: string
  statusLabel: string
}

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string }

function statusLabel(worktree: Worktree) {
  const parts = []

  if (worktree.isMain) {
    parts.push("main")
  }
  if (worktree.dirty) {
    parts.push("dirty")
  }
  if (worktree.ahead > 0) {
    parts.push(`ahead ${worktree.ahead}`)
  }
  if (worktree.behind > 0) {
    parts.push(`behind ${worktree.behind}`)
  }

  return parts.join(" · ") || "clean"
}

async function runPaletteAction(action: () => Promise<ActionResult>, onSuccess?: () => void) {
  let result

  try {
    result = await action()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Jet bridge unavailable")
    return false
  }

  if (!result.ok) {
    window.alert(result.error)
    return false
  }

  onSuccess?.()
  return true
}

export function CommandPalette({ onRefresh }: CommandPaletteProps) {
  const queryClient = useQueryClient()
  const { data } = useRepos()
  const { data: ides = [] } = useIdes()
  const { data: terminals = [] } = useTerminals()
  const {
    isCommandPaletteOpen,
    commandPalettePage,
    setCommandPaletteOpen,
    setTrackDialogOpen,
    setSettingsDialogOpen,
    openAddWorktreeDialog,
  } = useAppStore()

  const [page, setPage] = useState<PalettePage>("root")
  const [search, setSearch] = useState("")
  const [selectedWorktree, setSelectedWorktree] = useState<WorktreeItem | null>(null)

  const repos = data?.repos ?? []
  const repoBadgeClassByRoot = useMemo(() => {
    const badgeClasses = [
      "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
      "border-violet-500/40 bg-violet-500/10 text-violet-300",
      "border-amber-500/40 bg-amber-500/10 text-amber-300",
      "border-pink-500/40 bg-pink-500/10 text-pink-300",
      "border-sky-500/40 bg-sky-500/10 text-sky-300",
    ]

    return new Map(repos.map((repo, index) => [repo.rootPath, badgeClasses[index % badgeClasses.length]]))
  }, [repos])

  const worktrees = useMemo<WorktreeItem[]>(() => {
    return repos.flatMap((repo) =>
      repo.worktrees.map((worktree) => {
        const branchLabel = worktree.branch ?? "detached"
        return {
          repo,
          worktree,
          branchLabel,
          searchLabel: `${repo.repoSlug} ${repo.rootPath} ${branchLabel} ${worktree.path}`,
          statusLabel: statusLabel(worktree),
        }
      }),
    )
  }, [repos])

  useEffect(() => {
    setSearch("")
    setSelectedWorktree(null)

    if (isCommandPaletteOpen) {
      setPage(commandPalettePage)
      return
    }

    setPage("root")
  }, [commandPalettePage, isCommandPaletteOpen])

  function closePalette() {
    setCommandPaletteOpen(false)
  }

  function openPage(nextPage: PalettePage) {
    setSearch("")
    setPage(nextPage)
  }

  function goBack() {
    setSearch("")

    if (page === "open-ide-app") {
      setPage("open-ide-worktree")
      return
    }

    if (page === "open-terminal-app") {
      setPage("open-terminal-worktree")
      return
    }

    setSelectedWorktree(null)
    setPage("root")
  }

  async function refreshRepos() {
    await queryClient.invalidateQueries({ queryKey: ["repos"] })
    await queryClient.invalidateQueries({ queryKey: ["config"] })
    onRefresh()
  }

  async function handleUntrackRepo(repoPath: string) {
    const ok = await runPaletteAction(() => getJetBridge().untrackRepo(repoPath), () => {
      void refreshRepos()
      closePalette()
    })

    if (ok) {
      setPage("root")
    }
  }

  async function handleRemoveWorktree(item: WorktreeItem) {
    const ok = await runPaletteAction(() => getJetBridge().removeWorktree(item.repo.rootPath, item.branchLabel), () => {
      void refreshRepos()
      closePalette()
    })

    if (ok) {
      setPage("root")
    }
  }

  async function handleOpenIde(ide: InstalledIde) {
    if (!selectedWorktree) {
      return
    }

    const ok = await runPaletteAction(() => getJetBridge().openIde(ide.id, selectedWorktree.worktree.path), closePalette)
    if (ok) {
      setPage("root")
    }
  }

  async function handleOpenTerminal(terminal: InstalledTerminal) {
    if (!selectedWorktree) {
      return
    }

    const ok = await runPaletteAction(() => getJetBridge().openTerminalApp(terminal.id, selectedWorktree.worktree.path), closePalette)
    if (ok) {
      setPage("root")
    }
  }

  async function handleGoToWorktree(item: WorktreeItem) {
    const ok = await runPaletteAction(() => getJetBridge().openTerminal(item.worktree.path), closePalette)
    if (ok) {
      setPage("root")
    }
  }

  async function handleCopyWorktreePath(item: WorktreeItem) {
    try {
      await navigator.clipboard.writeText(item.worktree.path)
      closePalette()
      setPage("root")
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to copy worktree path")
    }
  }

  async function handleOpenRepoGithub(repoPath: string) {
    const ok = await runPaletteAction(() => getJetBridgeMethod("openRepoGithub")(repoPath), closePalette)
    if (ok) {
      setPage("root")
    }
  }

  function openTrackRepo() {
    closePalette()
    setTrackDialogOpen(true)
  }

  function openSettings() {
    closePalette()
    setSettingsDialogOpen(true)
  }

  function openAddWorktree(repoPath: string) {
    closePalette()
    openAddWorktreeDialog(repoPath)
  }

  function renderWorktreeItem(item: WorktreeItem) {
    const repoBadgeClass = repoBadgeClassByRoot.get(item.repo.rootPath) ?? "border-border bg-background text-muted-foreground"

    return (
      <>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="truncate text-sm">{item.branchLabel}</span>
            <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${repoBadgeClass}`}>
              {item.repo.repoSlug}
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">{item.repo.repoSlug} · {item.worktree.path}</div>
        </div>
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{item.statusLabel}</div>
      </>
    )
  }

  function pagePlaceholder() {
    switch (page) {
      case "add-worktree-repo":
        return "Choose a repo"
      case "remove-worktree":
        return "Choose a worktree to remove"
      case "open-ide-worktree":
        return "Choose a worktree to open"
      case "open-ide-app":
        return "Choose an IDE"
      case "open-terminal-worktree":
      case "go-to-worktree":
        return "Choose a worktree"
      case "open-terminal-app":
        return "Choose a terminal app"
      case "copy-worktree-path":
        return "Choose a worktree path"
      case "open-github-repo":
        return "Choose a repo to open on GitHub"
      case "untrack-repo":
        return "Choose a repo to untrack"
      default:
        return "Search commands"
    }
  }

  return (
    <CommandDialog open={isCommandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <Command
        shouldFilter
        onKeyDown={(event) => {
          if (event.key === "Backspace" && search.length === 0 && page !== "root") {
            event.preventDefault()
            goBack()
          }
        }}
      >
        <CommandInput value={search} onValueChange={setSearch} placeholder={pagePlaceholder()} />
        <CommandList>
          <CommandEmpty>No matching results.</CommandEmpty>

          {page !== "root" ? (
            <CommandGroup heading="Navigation">
              <CommandItem value="back" onSelect={goBack}>
                <CaretLeft size={16} />
                Back
              </CommandItem>
            </CommandGroup>
          ) : null}

          {page === "root" ? (
            <>
              <CommandGroup heading="Worktree">
                <CommandItem value="add worktree create branch" onSelect={() => openPage("add-worktree-repo")}>
                  <GitBranch size={16} />
                  Add Worktree...
                  <CommandShortcut>⌘N</CommandShortcut>
                </CommandItem>
                <CommandItem value="remove worktree delete branch" onSelect={() => openPage("remove-worktree")}>
                  <Trash size={16} />
                  Remove Worktree...
                </CommandItem>
                <CommandItem value="refresh repos worktrees reload" onSelect={() => void refreshRepos().then(closePalette)}>
                  <ArrowsClockwise size={16} />
                  Refresh
                  <CommandShortcut>⌘R</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Open">
                <CommandItem value="open in ide editor code cursor zed" onSelect={() => openPage("open-ide-worktree")}>
                  <Code size={16} />
                  Open in IDE...
                  <CommandShortcut>⌘I</CommandShortcut>
                </CommandItem>
                <CommandItem value="open in terminal shell iTerm warp ghostty" onSelect={() => openPage("open-terminal-worktree")}>
                  <Terminal size={16} />
                  Open in Terminal...
                  <CommandShortcut>⌘T</CommandShortcut>
                </CommandItem>
                <CommandItem value="open github repository repo page browser" onSelect={() => openPage("open-github-repo")}>
                  <GithubLogo size={16} />
                  Open GitHub Repository...
                  <CommandShortcut>⌘O</CommandShortcut>
                </CommandItem>
                <CommandItem value="copy worktree path" onSelect={() => openPage("copy-worktree-path")}>
                  <Copy size={16} />
                  Copy Worktree Path...
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Repository">
                <CommandItem value="track repository add repo" onSelect={openTrackRepo}>
                  <FolderPlus size={16} />
                  Track Repository
                </CommandItem>
                <CommandItem value="untrack repository remove repo" onSelect={() => openPage("untrack-repo")}>
                  <FolderMinus size={16} />
                  Untrack Repository...
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="App">
                <CommandItem value="settings preferences config" onSelect={openSettings}>
                  <GearSix size={16} />
                  Settings
                  <CommandShortcut>⌘,</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}

          {page === "add-worktree-repo" ? (
            <CommandGroup heading="Tracked Repos">
              {repos.map((repo) => (
                <CommandItem key={repo.rootPath} value={`${repo.repoSlug} ${repo.rootPath}`} onSelect={() => openAddWorktree(repo.rootPath)}>
                  <GitBranch size={16} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{repo.repoSlug}</div>
                    <div className="truncate text-xs text-muted-foreground">{repo.rootPath}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "remove-worktree" ? (
            <CommandGroup heading="All Worktrees">
              {worktrees.filter((item) => !item.worktree.isMain).map((item) => (
                <CommandItem key={item.worktree.path} value={item.searchLabel} onSelect={() => void handleRemoveWorktree(item)}>
                  <Trash size={16} />
                  {renderWorktreeItem(item)}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "open-ide-worktree" ? (
            <CommandGroup heading="All Worktrees">
              {worktrees.map((item) => (
                <CommandItem
                  key={item.worktree.path}
                  value={item.searchLabel}
                  onSelect={() => {
                    setSelectedWorktree(item)
                    setSearch("")
                    setPage("open-ide-app")
                  }}
                >
                  <Code size={16} />
                  {renderWorktreeItem(item)}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "open-ide-app" ? (
            <CommandGroup heading={selectedWorktree ? `Open ${selectedWorktree.branchLabel}` : "Installed IDEs"}>
              {ides.map((ide) => (
                <CommandItem key={ide.id} value={`${ide.name} ${ide.id}`} onSelect={() => void handleOpenIde(ide)}>
                  <Code size={16} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{ide.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{ide.appPath}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "open-terminal-worktree" ? (
            <CommandGroup heading="All Worktrees">
              {worktrees.map((item) => (
                <CommandItem
                  key={item.worktree.path}
                  value={item.searchLabel}
                  onSelect={() => {
                    setSelectedWorktree(item)
                    setSearch("")
                    setPage("open-terminal-app")
                  }}
                >
                  <Terminal size={16} />
                  {renderWorktreeItem(item)}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "open-github-repo" ? (
            <CommandGroup heading="Tracked Repos">
              {repos.map((repo) => (
                <CommandItem key={repo.rootPath} value={`${repo.repoSlug} ${repo.rootPath}`} onSelect={() => void handleOpenRepoGithub(repo.rootPath)}>
                  <GithubLogo size={16} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{repo.repoSlug}</div>
                    <div className="truncate text-xs text-muted-foreground">{repo.rootPath}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "open-terminal-app" ? (
            <CommandGroup heading={selectedWorktree ? `Open ${selectedWorktree.branchLabel}` : "Installed Terminals"}>
              {terminals.map((terminal) => (
                <CommandItem key={terminal.id} value={`${terminal.name} ${terminal.id}`} onSelect={() => void handleOpenTerminal(terminal)}>
                  <Terminal size={16} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{terminal.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{terminal.appPath}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "go-to-worktree" ? (
            <CommandGroup heading="All Worktrees">
              {worktrees.map((item) => (
                <CommandItem key={item.worktree.path} value={item.searchLabel} onSelect={() => void handleGoToWorktree(item)}>
                  <ArrowSquareOut size={16} />
                  {renderWorktreeItem(item)}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "copy-worktree-path" ? (
            <CommandGroup heading="All Worktrees">
              {worktrees.map((item) => (
                <CommandItem key={item.worktree.path} value={item.searchLabel} onSelect={() => void handleCopyWorktreePath(item)}>
                  <Copy size={16} />
                  {renderWorktreeItem(item)}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page === "untrack-repo" ? (
            <CommandGroup heading="Tracked Repos">
              {repos.map((repo) => (
                <CommandItem key={repo.rootPath} value={`${repo.repoSlug} ${repo.rootPath}`} onSelect={() => void handleUntrackRepo(repo.rootPath)}>
                  <FolderMinus size={16} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{repo.repoSlug}</div>
                    <div className="truncate text-xs text-muted-foreground">{repo.rootPath}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
