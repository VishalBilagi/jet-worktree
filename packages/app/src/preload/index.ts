import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("jet", {
  pickRepo: () => ipcRenderer.invoke("jet:pick-repo"),
  getConfig: () => ipcRenderer.invoke("jet:get-config"),
  listRepos: () => ipcRenderer.invoke("jet:list-repos"),
  trackRepo: (repoPath: string) => ipcRenderer.invoke("jet:track-repo", repoPath),
  addWorktree: (repoPath: string, branch: string) => ipcRenderer.invoke("jet:add-worktree", repoPath, branch),
  removeWorktree: (repoPath: string, branch: string) => ipcRenderer.invoke("jet:remove-worktree", repoPath, branch),
  listIdes: () => ipcRenderer.invoke("jet:list-ides"),
  openIde: (ideId: string, pathname: string) => ipcRenderer.invoke("jet:open-ide", ideId, pathname),
  listTerminals: () => ipcRenderer.invoke("jet:list-terminals"),
  openTerminalApp: (terminalId: string, pathname: string) => ipcRenderer.invoke("jet:open-terminal-app", terminalId, pathname),
  openTerminal: (pathname: string) => ipcRenderer.invoke("jet:open-terminal", pathname),
  onRefresh: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on("jet:refresh", listener)
    return () => ipcRenderer.removeListener("jet:refresh", listener)
  },
})

export {}
