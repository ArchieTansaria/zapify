"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fetchWorkflow, Workflow } from "@/lib/graphql/workflows"
import { useOrganization } from "@/components/providers/organization-provider"
import { WorkflowEditor } from "../components/workflow-editor"

export default function WorkflowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  
  const { currentOrganizationId, isLoading: orgLoading } = useOrganization()
  
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWorkflow = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchWorkflow(id)
      if (!data) {
        setError("Workflow not found")
        return
      }
      
      // Enforce organization boundary strictly on frontend too as a safety net
      if (data.org_id !== currentOrganizationId) {
        setError("Workflow not found or access denied")
        setWorkflow(null)
        return
      }
      
      setWorkflow(data)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err) || "Failed to load workflow")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (orgLoading) return
    if (!currentOrganizationId) {
      queueMicrotask(() => {
        setError("No organization selected")
        setIsLoading(false)
      })
      return
    }
    
    queueMicrotask(() => {
      loadWorkflow()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentOrganizationId, orgLoading])

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl mx-auto">
        <div className="h-4 w-24 bg-muted rounded mb-8"></div>
        <div className="h-10 w-1/3 bg-muted rounded"></div>
        <div className="h-4 w-1/4 bg-muted rounded mt-2"></div>
        
        <div className="mt-12 space-y-4">
          <div className="h-6 w-32 bg-muted rounded mb-4"></div>
          <div className="h-32 w-full bg-muted border rounded-md"></div>
        </div>
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" asChild className="gap-2 -ml-4 text-muted-foreground">
          <Link href="/app/workflows">
            <ArrowLeft className="h-4 w-4" />
            Back to workflows
          </Link>
        </Button>
        <div className="p-12 border rounded-md border-destructive/50 bg-destructive/10 text-center">
          <p className="text-destructive font-medium mb-4">{error}</p>
          <Button onClick={() => router.push("/app/workflows")} variant="outline">
            Return to list
          </Button>
        </div>
      </div>
    )
  }

  return (
    <WorkflowEditor 
      initialWorkflow={workflow} 
      onSaved={loadWorkflow} 
    />
  )
}
