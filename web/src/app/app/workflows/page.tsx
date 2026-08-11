"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Workflow, Activity, Clock, Layers } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ZapifyMark } from "@/components/brand/zapify-mark"

import { fetchWorkflows, Workflow as WorkflowType } from "@/lib/graphql/workflows"
import { useOrganization } from "@/components/providers/organization-provider"
import { CreateWorkflowDialog } from "./components/create-workflow-dialog"
import { WorkflowActions } from "./components/workflow-actions"

export default function WorkflowsPage() {
  const { currentOrganizationId, isLoading: orgLoading } = useOrganization()
  
  const [workflows, setWorkflows] = useState<WorkflowType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWorkflows = async () => {
    if (!currentOrganizationId) {
      setWorkflows([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchWorkflows(currentOrganizationId)
      setWorkflows(data)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err) || "Failed to load workflows")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (orgLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkflows()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganizationId, orgLoading])

  // Handle orgLoading state to prevent layout jumps
  if (orgLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded"></div>
        <div className="h-64 w-full bg-muted rounded-md mt-8"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-2">
            Design and manage your automated AI sequences.
          </p>
        </div>
        
        {(!isLoading && !error && workflows.length > 0) && (
          <CreateWorkflowDialog />
        )}
      </div>

      {isLoading ? (
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-full bg-muted animate-pulse rounded-md border" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-8 p-6 border rounded-md border-destructive/50 bg-destructive/10 text-center">
          <p className="text-destructive font-medium mb-4">{error}</p>
          <Button onClick={loadWorkflows} variant="outline">Try again</Button>
        </div>
      ) : workflows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={ZapifyMark}
            title="No workflows yet"
            description="Build an automated AI workflow by connecting models, APIs, conditions, and approval steps."
            action={<CreateWorkflowDialog />}
          />
        </div>
      ) : (
        <div className="mt-8 border rounded-md divide-y overflow-hidden bg-card">
          {workflows.map((wf) => {
            const stepCount = wf.workflow_steps?.length || 0
            const triggers = wf.workflow_triggers?.map(t => t.trigger_type) || []
            
            return (
              <div key={wf.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group">
                <Link href={`/app/workflows/${wf.id}`} className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                      {wf.name}
                    </h3>
                    {!wf.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Layers className="h-3.5 w-3.5" />
                      {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                    </div>
                    {triggers.length > 0 && (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Activity className="h-3.5 w-3.5" />
                        {triggers.join(", ")}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(wf.updated_at).toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </Link>
                
                <div className="flex items-center shrink-0">
                  <WorkflowActions 
                    workflowId={wf.id} 
                    workflowName={wf.name} 
                    onUpdate={loadWorkflows} 
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
