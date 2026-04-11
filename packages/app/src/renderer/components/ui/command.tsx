import { Command as CommandPrimitive } from "cmdk"
import { MagnifyingGlass } from "@phosphor-icons/react"
import type { ComponentProps } from "react"
import { cn } from "@renderer/lib/utils"
import { Dialog, DialogContent } from "./dialog"

export function CommandDialog({ children, ...props }: ComponentProps<typeof Dialog>) {
  return (
    <Dialog {...props}>
      <DialogContent className="left-1/2 top-20 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 translate-y-0 overflow-hidden p-0 sm:top-24 sm:w-[min(52rem,calc(100vw-3rem))]" showClose={false}>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive className={cn("flex h-full w-full flex-col overflow-hidden bg-surface text-foreground", className)} {...props} />
}

export function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4">
      <MagnifyingGlass size={16} className="text-muted-foreground" />
      <CommandPrimitive.Input
        className={cn("flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)}
        {...props}
      />
    </div>
  )
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn("max-h-[24rem] overflow-y-auto overflow-x-hidden p-2", className)} {...props} />
}

export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="px-3 py-8 text-center text-sm text-muted-foreground" {...props} />
}

export function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn("overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground", className)}
      {...props}
    />
  )
}

export function CommandSeparator({ className, ...props }: ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-3 rounded-sm px-2 py-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-hover data-[selected=true]:text-accent",
        className,
      )}
      {...props}
    />
  )
}

export function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ml-auto text-[11px] uppercase tracking-[0.08em] text-muted-foreground", className)} {...props} />
}
