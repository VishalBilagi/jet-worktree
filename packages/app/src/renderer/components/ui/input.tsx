import type { InputHTMLAttributes } from "react"
import { cn } from "@renderer/lib/utils"

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full border border-border bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent",
        className,
      )}
      {...props}
    />
  )
}
