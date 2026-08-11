import * as React from "react"
import { cn } from "@/lib/utils"
import { ZapifyMark } from "./zapify-mark"

export function ZapifyLogo({ className, markClassName, textClassName }: { className?: string, markClassName?: string, textClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ZapifyMark className={cn("h-5 w-5", markClassName)} />
      <span className={cn("font-bold tracking-tight", textClassName)}>ZAPIFY</span>
    </div>
  )
}
