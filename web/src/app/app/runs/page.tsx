"use client"

import { useEffect, useState, useMemo } from "react"
import { Activity, Clock, AlertCircle, PlayCircle } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/components/ui/status-badge"
import { useOrganization } from "@/components/providers/organization-provider"
import { fetchRuns, WorkflowRun } from "@/lib/graphql/runs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"

export default function RunsPage() {
  const { currentOrganizationId } = useOrganization()
  
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const loadRuns = async () => {
    if (!currentOrganizationId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchRuns(currentOrganizationId)
      setRuns(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load runs.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganizationId])

  const filteredRuns = useMemo(() => {
    if (statusFilter === "all") return runs
    return runs.filter(run => run.status === statusFilter)
  }, [runs, statusFilter])

  const [now] = useState(() => Date.now())

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start) return "-"
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : now
    const diff = Math.max(0, endTime - startTime)
    
    const s = Math.floor(diff / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)

    if (h > 0) return `${h}h ${m % 60}m`
    if (m > 0) return `${m}m ${s % 60}s`
    if (s > 0) return `${s}s`
    return `${diff}ms`
  }

  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Runs</h1>
          <p className="text-muted-foreground mt-2">
            Track workflow executions across your organization.
          </p>
        </div>
        
        {!isLoading && !error && runs.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 hidden md:block" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 border rounded-xl bg-destructive/10 text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div className="text-destructive font-medium">{error}</div>
          <Button variant="outline" onClick={loadRuns}>Try Again</Button>
        </div>
      ) : runs.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Activity}
            title="No runs yet"
            description="Run a workflow to see its executions here."
          />
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="text-center py-12 border rounded-xl text-muted-foreground">
          No runs match the selected status filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRuns.map((run) => (
            <Link 
              key={run.id} 
              href={`/app/runs/${run.id}`}
              className="block group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors">
                
                {/* Left Section: Icon & Info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-muted border group-hover:bg-primary/5 transition-colors">
                    <PlayCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{run.workflow?.name || 'Unknown Workflow'}</span>
                      <span className="text-xs text-muted-foreground font-mono hidden sm:inline-block">
                        {run.id.substring(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(run.started_at || run.created_at)}
                      </span>
                      <span className="text-border">•</span>
                      <span className="truncate capitalize">{run.trigger_type.replace('_', ' ')} trigger</span>
                    </div>
                  </div>
                </div>

                {/* Right Section: Status & Duration */}
                <div className="flex items-center gap-4 justify-between md:justify-end shrink-0 pl-14 md:pl-0">
                  <div className="text-sm text-muted-foreground tabular-nums text-right">
                    {formatDuration(run.started_at, run.completed_at)}
                  </div>
                  <div className="w-[100px] flex justify-end">
                    <StatusBadge status={run.status} />
                  </div>
                </div>

              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
