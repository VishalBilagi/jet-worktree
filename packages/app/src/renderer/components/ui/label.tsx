import type { LabelHTMLAttributes } from "react"
import { cn } from "@renderer/lib/utils"

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("font-heading text-xs font-semibold uppercase tracking-[0.04em] text-foreground", className)} {...props} />
}
