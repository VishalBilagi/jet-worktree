import { FormEvent, useState } from "react"
import { FolderOpen } from "@phosphor-icons/react"
import { getJetBridge } from "@renderer/lib/bridge"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type TrackRepoDialogProps = {
  open: boolean
  onClose: () => void
  onTracked: () => void
}

export function TrackRepoDialog({ open, onClose, onTracked }: TrackRepoDialogProps) {
  const [value, setValue] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePickRepo() {
    setError(null)

    let result
    try {
      result = await getJetBridge().pickRepo()
    } catch (bridgeError) {
      setError(bridgeError instanceof Error ? bridgeError.message : "Jet bridge unavailable")
      return
    }

    if (!result.ok) {
      setError(result.error)
      return
    }

    if (result.path) {
      setValue(result.path)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!value.trim()) {
      setError("Repo path is required")
      return
    }
    setSubmitting(true)
    setError(null)

    let result
    try {
      result = await getJetBridge().trackRepo(value.trim())
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

    setValue("")
    onTracked()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent aria-label="Track repository">
        <DialogHeader>
          <div className="space-y-1 pr-10">
            <DialogTitle>Track Repo</DialogTitle>
            <DialogDescription>Add an existing git repo to Jet.</DialogDescription>
          </div>
        </DialogHeader>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="track-repo-path">Repo path</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="track-repo-path"
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="/path/to/repo"
                className="flex-1"
              />
              <Button type="button" onClick={handlePickRepo} className="h-11 px-4">
                <FolderOpen size={16} />
                Choose Folder
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Point Jet at an existing local git repository.</p>
          {error ? <div className="text-sm text-status-error">{error}</div> : null}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>{submitting ? "Tracking..." : "Track Repo"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
