import * as React from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50",
        className
      )}
      {...props}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
        {Icon ? (
          <Icon className="h-10 w-10 text-muted-foreground" />
        ) : (
          <div className="h-10 w-10 rounded-sm bg-muted-foreground/20" />
        )}
      </div>
      <h2 className="mt-6 text-xl font-semibold">{title}</h2>
      {description && (
        <p className="mt-2 mb-8 text-center text-sm font-normal leading-6 text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
