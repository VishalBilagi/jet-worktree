import { create } from "zustand"

type CommandPalettePage = "root" | "go-to-worktree" | "open-terminal-worktree" | "open-ide-worktree" | "open-github-repo"

type AppState = {
  isCommandPaletteOpen: boolean
  commandPalettePage: CommandPalettePage
  isTrackDialogOpen: boolean
  isSettingsDialogOpen: boolean
  addWorktreeRepoPath: string | null
  setCommandPaletteOpen: (open: boolean) => void
  openCommandPalette: (page?: CommandPalettePage) => void
  setTrackDialogOpen: (open: boolean) => void
  setSettingsDialogOpen: (open: boolean) => void
  openAddWorktreeDialog: (repoPath: string) => void
  closeAddWorktreeDialog: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isCommandPaletteOpen: false,
  commandPalettePage: "root",
  isTrackDialogOpen: false,
  isSettingsDialogOpen: false,
  addWorktreeRepoPath: null,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open, commandPalettePage: "root" }),
  openCommandPalette: (page = "root") => set({ isCommandPaletteOpen: true, commandPalettePage: page }),
  setTrackDialogOpen: (open) => set({ isTrackDialogOpen: open }),
  setSettingsDialogOpen: (open) => set({ isSettingsDialogOpen: open }),
  openAddWorktreeDialog: (repoPath) => set({ addWorktreeRepoPath: repoPath }),
  closeAddWorktreeDialog: () => set({ addWorktreeRepoPath: null }),
}))
