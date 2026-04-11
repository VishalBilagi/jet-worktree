import type { ComponentProps } from "react"
import { cn } from "@renderer/lib/utils"

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("border border-border bg-background", className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("border-b border-border bg-secondary px-4 py-3", className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(className)} {...props} />
}
