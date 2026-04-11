import { create } from "zustand"

type AppState = {
  isTrackDialogOpen: boolean
  isSettingsDialogOpen: boolean
  addWorktreeRepoPath: string | null
  setTrackDialogOpen: (open: boolean) => void
  setSettingsDialogOpen: (open: boolean) => void
  openAddWorktreeDialog: (repoPath: string) => void
  closeAddWorktreeDialog: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isTrackDialogOpen: false,
  isSettingsDialogOpen: false,
  addWorktreeRepoPath: null,
  setTrackDialogOpen: (open) => set({ isTrackDialogOpen: open }),
  setSettingsDialogOpen: (open) => set({ isSettingsDialogOpen: open }),
  openAddWorktreeDialog: (repoPath) => set({ addWorktreeRepoPath: repoPath }),
  closeAddWorktreeDialog: () => set({ addWorktreeRepoPath: null }),
}))
