"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { StatusBadge } from "@/components/ui/status-badge"
import { useOrganization } from "@/components/providers/organization-provider"
import { fetchRunDetails, subscribeToRunDetails, approveStepRun, WorkflowRun, StepRun } from "@/lib/graphql/runs"
import { Button } from "@/components/ui/button"
import { WorkflowCanvas } from "@/app/app/workflows/components/workflow-canvas"
import { buildGraphFromBackend } from "@/app/app/workflows/lib/graph"
import { Node, Edge } from "@xyflow/react"
import { WorkflowTrigger } from "@/lib/graphql/workflows"

function formatDuration(start: string | null, end: string | null, now: number) {
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

function formatDate(date: string | null) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date))
}

function StepRunItem({ stepRun, now, onApprove }: { stepRun: StepRun, now: number, onApprove: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  const handleApprove = async () => {
    setIsApproving(true)
    await onApprove()
    setIsApproving(false)
  }

  return (
    <div className="border-b last:border-0 border-border">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              {stepRun.workflow_step.name}
            </div>
            <div className="text-xs text-muted-foreground capitalize mt-0.5">
              {stepRun.workflow_step.step_type.replace('_', ' ')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground tabular-nums text-xs hidden sm:inline-block">
            {formatDuration(stepRun.started_at, stepRun.completed_at, now)}
          </span>
          <StatusBadge status={stepRun.status} />
        </div>
      </div>

      {expanded && (
        <div className="p-4 pt-0 text-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Input</span>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto border">
                {stepRun.input ? JSON.stringify(stepRun.input, null, 2) : "null"}
              </pre>
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Output</span>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto border">
                {stepRun.output ? JSON.stringify(stepRun.output, null, 2) : "null"}
              </pre>
            </div>
          </div>
          
          {stepRun.error && (
            <div className="space-y-1">
              <span className="text-xs font-semibold text-destructive uppercase tracking-wider">Error</span>
              <pre className="bg-destructive/10 text-destructive p-3 rounded-lg text-xs overflow-x-auto border border-destructive/20 whitespace-pre-wrap">
                {stepRun.error}
              </pre>
            </div>
          )}

          {stepRun.status === 'waiting_for_approval' && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-amber-600 dark:text-amber-400">Approval Required</h4>
                <p className="text-xs text-amber-600/80 mt-1">This step is paused and waiting for approval to continue.</p>
              </div>
              <Button 
                onClick={handleApprove} 
                disabled={isApproving}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isApproving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve Step
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RunDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { currentOrganizationId } = useOrganization()
  
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected')

  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  const loadRun = async (showLoadingState = false) => {
    if (!currentOrganizationId || !id) return
    if (showLoadingState) setIsLoading(true)
    setError(null)
    try {
      const data = await fetchRunDetails(id)
      if (!data) {
        setError("Run not found or access denied.")
        setIsLoading(false)
        return
      }

      setRun(data)
      rehydrateNodes(data)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load run details.")
    } finally {
      setIsLoading(false)
    }
  }

  const rehydrateNodes = (currentRun: WorkflowRun) => {
      // Reconstruct graph
      const triggers = (currentRun.workflow.workflow_triggers || []) as unknown as WorkflowTrigger[]
      const steps = currentRun.workflow.workflow_steps || []
      const { nodes: backendNodes, edges: backendEdges } = buildGraphFromBackend(steps, triggers)

      // Hydrate nodes with status
      const hydratedNodes = backendNodes.map(node => {
        if (node.type === 'triggerNode') {
          // Triggers are considered completed once the run starts
          return { ...node, data: { ...node.data, status: 'completed' } }
        }
        const stepRun = currentRun.step_runs?.find(sr => sr.workflow_step.id === node.id)
        if (stepRun) {
          return { ...node, data: { ...node.data, status: stepRun.status } }
        }
        return { ...node, data: { ...node.data, status: 'pending' } }
      })

      setNodes(hydratedNodes)
      setEdges(backendEdges)
  }

  const reconcileRun = (prev: WorkflowRun, next: Partial<WorkflowRun>): WorkflowRun => {
    if (prev.id !== next.id) return prev

    const updatedStepRuns = [...(prev.step_runs || [])]
    const newStepRuns = next.step_runs || []

    newStepRuns.forEach((newSr: Partial<StepRun>) => {
      const idx = updatedStepRuns.findIndex(sr => sr.id === newSr.id)
      if (idx >= 0) {
        updatedStepRuns[idx] = {
          ...updatedStepRuns[idx],
          ...newSr,
          workflow_step: updatedStepRuns[idx].workflow_step
        }
      } else {
        const workflowStep = prev.workflow.workflow_steps?.find(ws => ws.id === newSr.workflow_step_id)
        if (workflowStep && newSr.id && newSr.status && newSr.step_order !== undefined) {
          updatedStepRuns.push({
            id: newSr.id,
            status: newSr.status,
            step_order: newSr.step_order,
            input: newSr.input || null,
            output: newSr.output || null,
            error: newSr.error || null,
            started_at: newSr.started_at || null,
            completed_at: newSr.completed_at || null,
            workflow_step: workflowStep
          })
        }
      }
    })

    updatedStepRuns.sort((a, b) => a.step_order - b.step_order)

    return {
      ...prev,
      status: next.status || prev.status,
      started_at: next.started_at || prev.started_at,
      completed_at: next.completed_at || prev.completed_at,
      error: next.error || prev.error,
      step_runs: updatedStepRuns
    }
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRun().then(() => {
      if (!currentOrganizationId || !id) return
      setConnectionState('connecting')
      
      unsubscribe = subscribeToRunDetails(
        id,
        (data) => {
          setConnectionState('connected')
          if (data && data.workflow_runs_by_pk) {
            setRun(prev => {
              if (!prev) return prev
              const updatedRun = reconcileRun(prev, data.workflow_runs_by_pk as Partial<WorkflowRun>)
              rehydrateNodes(updatedRun)
              return updatedRun
            })
          }
        },
        (err) => {
          console.error("Subscription error", err)
          setConnectionState('disconnected')
        },
        () => {
          setConnectionState('disconnected')
        }
      )
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganizationId, id])

  const handleApprove = async (stepRunId: string) => {
    try {
      await approveStepRun(stepRunId)
      // The subscription will automatically deliver the updated state
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to approve step.")
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="space-y-6 p-6">
        <Button variant="ghost" onClick={() => router.push('/app/runs')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Runs
        </Button>
        <div className="p-8 border rounded-xl bg-destructive/10 text-center space-y-4 max-w-lg mx-auto">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div className="text-destructive font-medium">{error || 'Run not found'}</div>
          <Button variant="outline" onClick={() => router.push('/app/runs')}>Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="shrink-0 p-6 border-b flex flex-col md:flex-row md:items-start justify-between gap-6 bg-card z-10">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/app/runs')} className="mb-4 -ml-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Runs
          </Button>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">{run.workflow.name}</h1>
            <StatusBadge status={run.status} />
            <div className="flex items-center gap-2 text-xs font-medium bg-muted/50 px-2 py-1 rounded-full border">
              <span className="relative flex h-2 w-2">
                {connectionState === 'connected' && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </>
                )}
                {connectionState === 'connecting' && <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>}
                {(connectionState === 'disconnected' || connectionState === 'reconnecting') && <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground"></span>}
              </span>
              <span className="capitalize text-muted-foreground">{connectionState}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-3">
            <span className="font-mono bg-muted px-2 py-1 rounded-md text-xs">{run.id.substring(0, 8)}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {formatDate(run.started_at || run.created_at)}</span>
            <span className="capitalize">{run.trigger_type.replace('_', ' ')} trigger</span>
            <span className="tabular-nums">Duration: {formatDuration(run.started_at, run.completed_at, now)}</span>
          </div>
          {run.error && (
            <div className="mt-4 bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 max-w-3xl">
              <span className="font-semibold">Run Error:</span> {run.error}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
        {/* Left Sidebar: Timeline */}
        <div className="w-full md:w-[450px] shrink-0 border-r bg-background overflow-y-auto flex flex-col z-20 shadow-xl">
          <div className="p-4 border-b bg-card sticky top-0 z-10">
            <h3 className="font-semibold">Execution Timeline</h3>
            <p className="text-xs text-muted-foreground">Chronological sequence of step executions.</p>
          </div>
          <div className="flex-1">
            {run.step_runs && run.step_runs.length > 0 ? (
              run.step_runs.map((stepRun) => (
                <StepRunItem 
                  key={stepRun.id} 
                  stepRun={stepRun} 
                  now={now} 
                  onApprove={() => handleApprove(stepRun.id)}
                />
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No steps executed yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Read-Only Graph */}
        <div className="flex-1 bg-muted/20 relative min-h-[500px]">
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={() => {}}
            onEdgesChange={() => {}}
            onConnect={() => {}}
            isReadOnly={true}
          />
        </div>
      </div>
    </div>
  )
}
