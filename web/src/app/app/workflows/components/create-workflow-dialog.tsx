"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { createWorkflow } from "@/lib/graphql/workflows"
import { useOrganization } from "@/components/providers/organization-provider"

export function CreateWorkflowDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { currentOrganizationId, currentUserRole } = useOrganization()
  const router = useRouter()

  const canCreate = currentUserRole === "owner" || currentUserRole === "editor"

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError("Workflow name is required")
      return
    }

    if (name.length > 50) {
      setError("Workflow name is too long")
      return
    }

    if (!currentOrganizationId) {
      setError("No organization selected")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const wf = await createWorkflow(currentOrganizationId, name.trim())
      setOpen(false)
      setName("")
      router.push(`/app/workflows/${wf.id}`)
      router.refresh()
    } catch (err: unknown) {
      console.error(err)
      setError((err as Error).message || "Failed to create workflow")
    } finally {
      setIsLoading(false)
    }
  }

  // If viewers shouldn't even see the button as active (they are blocked by backend anyway)
  // we could just disable it or hide it, but returning children or a disabled trigger is fine.
  
  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val)
      if (!val) {
        setName("")
        setError(null)
      }
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button disabled={!canCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Create workflow
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>
              Create a new automated AI workflow. You can add triggers and steps later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer Support Agent"
                autoComplete="off"
                disabled={isLoading}
              />
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? "Creating..." : "Create workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
