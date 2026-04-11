import { AppWindow, CaretDown, Code, SpinnerGap } from "@phosphor-icons/react"
import { useRef, useState } from "react"
import { getJetBridge } from "@renderer/lib/bridge"
import type { InstalledIde, InstalledTerminal } from "@renderer/lib/types"
import { Button } from "./ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"

type OpenMenuProps = {
  worktreePath: string
  ides: InstalledIde[]
  terminals: InstalledTerminal[]
  isIdeLoading: boolean
  isTerminalLoading: boolean
}

function AppIcon({ iconClass }: { iconClass: string | null }) {
  if (!iconClass) {
    return <AppWindow size={16} className="text-muted-foreground" />
  }

  return <i className={`${iconClass} text-base leading-none text-foreground`} aria-hidden="true" />
}

async function openIde(ideId: string, worktreePath: string) {
  const result = await getJetBridge().openIde(ideId, worktreePath)
  if (!result.ok) {
    window.alert(result.error)
  }
}

async function openTerminal(terminalId: string, worktreePath: string) {
  const result = await getJetBridge().openTerminalApp(terminalId, worktreePath)
  if (!result.ok) {
    window.alert(result.error)
  }
}

function OpenMenuContent({ worktreePath, ides, terminals }: Pick<OpenMenuProps, "worktreePath" | "ides" | "terminals">) {
  return (
    <>
      <DropdownMenuLabel>Open In IDE</DropdownMenuLabel>
      {ides.length === 0 ? (
        <DropdownMenuItem disabled>No supported IDEs found</DropdownMenuItem>
      ) : (
        ides.map((ide) => (
          <DropdownMenuItem key={ide.id} onSelect={() => void openIde(ide.id, worktreePath)}>
            <AppIcon iconClass={ide.iconClass} />
            <span>{ide.name}</span>
          </DropdownMenuItem>
        ))
      )}
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Open In Terminal</DropdownMenuLabel>
      {terminals.length === 0 ? (
        <DropdownMenuItem disabled>No supported terminals found</DropdownMenuItem>
      ) : (
        terminals.map((terminal) => (
          <DropdownMenuItem key={terminal.id} onSelect={() => void openTerminal(terminal.id, worktreePath)}>
            <AppIcon iconClass={terminal.iconClass} />
            <span>{terminal.name}</span>
          </DropdownMenuItem>
        ))
      )}
    </>
  )
}

export function OpenMenu({ worktreePath, ides, terminals, isIdeLoading, isTerminalLoading }: OpenMenuProps) {
  const isLoading = isIdeLoading || isTerminalLoading
  const isDisabled = isLoading || (ides.length === 0 && terminals.length === 0)
  const [open, setOpen] = useState(false)
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearOpenTimeout() {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current)
      openTimeoutRef.current = null
    }
  }

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  function handleHoverOpen() {
    if (isDisabled) {
      return
    }

    clearOpenTimeout()
    clearCloseTimeout()
    openTimeoutRef.current = setTimeout(() => {
      setOpen(true)
    }, 100)
  }

  function handleHoverClose() {
    clearOpenTimeout()
    clearCloseTimeout()
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false)
    }, 120)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          type="button"
          title="Open"
          disabled={isDisabled}
          onMouseEnter={handleHoverOpen}
          onMouseLeave={handleHoverClose}
        >
          {isLoading ? <SpinnerGap size={16} className="animate-spin" /> : <Code size={18} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onMouseEnter={handleHoverOpen} onMouseLeave={handleHoverClose}>
        <OpenMenuContent worktreePath={worktreePath} ides={ides} terminals={terminals} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function OpenTextMenu({ worktreePath, ides, terminals, isIdeLoading, isTerminalLoading }: OpenMenuProps) {
  const isLoading = isIdeLoading || isTerminalLoading
  const isDisabled = isLoading || (ides.length === 0 && terminals.length === 0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1 text-sm text-accent disabled:opacity-50" type="button" disabled={isDisabled}>
          Open
          <CaretDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <OpenMenuContent worktreePath={worktreePath} ides={ides} terminals={terminals} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
