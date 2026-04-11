import { useQuery } from "@tanstack/react-query"
import { getJetBridge } from "@renderer/lib/bridge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"

type SettingsDialogProps = {
  open: boolean
  onClose: () => void
}

type ConfigPayload = {
  configPath: string
  worktreeRoot: string
  trackedRepos: string[]
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border border-border bg-background px-3 py-3">
      <div className="font-heading text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</div>
      <div className="break-all text-sm text-foreground">{value}</div>
    </div>
  )
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const result = await getJetBridge().getConfig()
      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data as ConfigPayload
    },
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent aria-label="Settings">
        <DialogHeader>
          <div className="space-y-1 pr-10">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Jet configuration and current local defaults.</DialogDescription>
          </div>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          {isLoading ? <div className="border border-border px-3 py-4 text-sm text-muted-foreground">Loading config...</div> : null}
          {error ? <div className="border border-border px-3 py-4 text-sm text-status-error">{error.message}</div> : null}
          {data ? (
            <>
              <SettingsRow label="Config Path" value={data.configPath} />
              <SettingsRow label="Worktree Root" value={data.worktreeRoot} />
              <div className="grid gap-2 border border-border bg-background px-3 py-3">
                <div className="font-heading text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Tracked Repos</div>
                {data.trackedRepos.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No repos tracked yet.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.trackedRepos.map((repo) => (
                      <div key={repo} className="break-all text-sm text-foreground">{repo}</div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
