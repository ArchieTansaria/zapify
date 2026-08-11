"use client"

import { useState } from "react"
import { MoreVertical, Edit2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

import { updateWorkflow, deleteWorkflow } from "@/lib/graphql/workflows"
import { useOrganization } from "@/components/providers/organization-provider"

interface WorkflowActionsProps {
  workflowId: string
  workflowName: string
  onUpdate?: () => void
}

export function WorkflowActions({ workflowId, workflowName, onUpdate }: WorkflowActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  
  const [name, setName] = useState(workflowName)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { currentUserRole } = useOrganization()
  const router = useRouter()

  const canRename = currentUserRole === "owner" || currentUserRole === "editor"
  const canDelete = currentUserRole === "owner"

  // Viewers don't see mutation actions at all
  if (!canRename && !canDelete) {
    return null
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Workflow name is required")
      return
    }
    
    setIsLoading(true)
    setError(null)
    try {
      await updateWorkflow(workflowId, name.trim())
      setRenameOpen(false)
      onUpdate?.()
      router.refresh()
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err) || "Failed to rename workflow")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await deleteWorkflow(workflowId)
      setDeleteOpen(false)
      onUpdate?.()
      router.refresh()
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err) || "Failed to delete workflow")
      setIsLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 focus-visible:ring-1">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canRename && (
            <DropdownMenuItem onClick={() => {
              setName(workflowName)
              setRenameOpen(true)
            }}>
              <Edit2 className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
          )}
          {canRename && canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem 
              className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={(val) => {
        setRenameOpen(val)
        if (!val) {
          setError(null)
          setName(workflowName)
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename Workflow</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="rename-name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="rename-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  autoComplete="off"
                />
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim() || name === workflowName}>
                {isLoading ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(val) => {
        setDeleteOpen(val)
        if (!val) setError(null)
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{workflowName}&quot;? This action cannot be undone and will permanently delete the workflow and its associated configuration.
            </DialogDescription>
          </DialogHeader>
          
          {error && <p className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md">{error}</p>}
          
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
