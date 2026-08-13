import { useState, useMemo, useCallback } from "react"
import { useNodesState, useEdgesState, addEdge, Connection, Edge, Node } from "@xyflow/react"
import { buildGraphFromBackend } from "../lib/graph"
import { validateAndSerializeGraph } from "../lib/validation"
import { Workflow, WorkflowStep, WorkflowTrigger, createWorkflowStep, updateWorkflowStep, deleteWorkflowStep, createWorkflowTrigger, updateWorkflowTrigger, deleteWorkflowTrigger } from "@/lib/graphql/workflows"
import { useOrganization } from "@/components/providers/organization-provider"
import { WorkflowToolbar } from "./workflow-toolbar"
import { WorkflowStepCard } from "./workflow-step-card"
import { WorkflowStepEditor } from "./workflow-step-editor"
import { TriggerEditor } from "./trigger-editor"
import { WorkflowNodePalette } from "./workflow-node-palette"
import { WorkflowInspector } from "./workflow-inspector"
import { WorkflowCanvas } from "./workflow-canvas"
import { Zap } from "lucide-react"

interface WorkflowEditorProps {
  initialWorkflow: Workflow
  onSaved: () => void
}

export function WorkflowEditor({ initialWorkflow, onSaved }: WorkflowEditorProps) {
  const { currentUserRole } = useOrganization()
  const canEdit = currentUserRole === "owner" || currentUserRole === "editor"
  
  const [steps, setSteps] = useState<WorkflowStep[]>(initialWorkflow.workflow_steps || [])
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>(initialWorkflow.workflow_triggers || [])
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved")
  
  const [activeStep, setActiveStep] = useState<WorkflowStep | null>(null)
  const [isStepEditorOpen, setIsStepEditorOpen] = useState(false)
  const [isTriggerEditorOpen, setIsTriggerEditorOpen] = useState(false)

  // Initialize React Flow state once on mount from the backend data
  const initialGraph = useMemo(() => buildGraphFromBackend(steps, triggers), [])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges)

  const handleConnect = useCallback((connection: Connection | Edge) => {
    setEdges((eds) => addEdge(connection, eds))
    setSaveState("unsaved")
  }, [setEdges])

  // Mark as unsaved if steps or triggers change. 
  // We avoid strict deep equality for performance, trusting our setters to only run on actual mutations.

  const handleSaveStep = (updatedStep: WorkflowStep) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === updatedStep.id)
      if (idx >= 0) {
        const newSteps = [...prev]
        newSteps[idx] = updatedStep
        return newSteps
      } else {
        return [...prev, updatedStep]
      }
    })
    setSaveState("unsaved")
  }

  const handleDeleteStep = (id: string) => {
    setSteps(prev => {
      const remaining = prev.filter(s => s.id !== id)
      // re-calculate step_order sequentially
      return remaining.map((s, idx) => ({ ...s, step_order: idx }))
    })
    setSaveState("unsaved")
  }

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return

    setSteps(prev => {
      const newSteps = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      
      // Swap
      const temp = newSteps[index]
      newSteps[index] = newSteps[targetIndex]
      newSteps[targetIndex] = temp
      
      // Re-assign step_order
      return newSteps.map((s, idx) => ({ ...s, step_order: idx }))
    })
    setSaveState("unsaved")
  }

  const handleSaveTriggers = (newTriggers: WorkflowTrigger[]) => {
    setTriggers(newTriggers)
    setSaveState("unsaved")
  }

  const persistChanges = async () => {
    setSaveState("saving")
    try {
      // 0. Validate and Serialize the React Flow graph
      const { steps: newSteps, triggers: newTriggers, error } = validateAndSerializeGraph(nodes, edges)
      
      if (error) {
        alert(error)
        setSaveState("error")
        return
      }
      
      // Update local state with the serialized result
      setSteps(newSteps)
      setTriggers(newTriggers)

      // 1. Process Triggers
      const initialTriggerIds = (initialWorkflow.workflow_triggers || []).map(t => t.id)
      const currentTriggerIds = newTriggers.filter(t => !t.id.startsWith('draft-')).map(t => t.id)
      const triggersToDelete = initialTriggerIds.filter(id => !currentTriggerIds.includes(id))
      
      for (const id of triggersToDelete) {
        await deleteWorkflowTrigger(id)
      }
      const idMap = new Map<string, string>()

      for (const t of newTriggers) {
        if (t.id.startsWith('draft-')) {
          const created = await createWorkflowTrigger(initialWorkflow.id, t.trigger_type, t.config)
          if (created) idMap.set(t.id, created.id)
        } else {
          if (t.trigger_type !== 'webhook') {
            await updateWorkflowTrigger(t.id, t.config, t.is_active)
          }
        }
      }

      // 2. Process Steps
      const initialStepIds = (initialWorkflow.workflow_steps || []).map(s => s.id)
      const currentRealIds = newSteps.map(s => s.id)
      const stepsToDelete = initialStepIds.filter(id => !currentRealIds.includes(id))

      for (const id of stepsToDelete) {
        await deleteWorkflowStep(id)
      }

      // PRE-PASS: Temporarily shift step_order of existing steps to avoid unique constraint violations
      // when swapping orders of existing steps. PostgreSQL checks constraints per-statement.
      const stepsToUpdate = newSteps.filter(s => initialStepIds.includes(s.id))
      for (let i = 0; i < stepsToUpdate.length; i++) {
        const s = stepsToUpdate[i]
        await updateWorkflowStep(s.id, s.name, s.config, i + 10000)
      }

      for (let i = 0; i < newSteps.length; i++) {
        const s = newSteps[i]
        if (initialStepIds.includes(s.id)) {
          await updateWorkflowStep(s.id, s.name, s.config, i)
        } else {
          const created = await createWorkflowStep(initialWorkflow.id, s.step_type, s.name, i, s.config)
          if (created) idMap.set(s.id, created.id)
        }
      }

      if (idMap.size > 0) {
        setNodes(nds => nds.map(n => idMap.has(n.id) ? { ...n, id: idMap.get(n.id)! } : n))
        setEdges(eds => eds.map(e => {
          const newE = { ...e }
          if (idMap.has(newE.source)) newE.source = idMap.get(newE.source)!
          if (idMap.has(newE.target)) newE.target = idMap.get(newE.target)!
          // Update the edge ID as well to avoid referencing old draft IDs
          newE.id = `e-${newE.source}-${newE.sourceHandle ? newE.sourceHandle + '-' : ''}${newE.target}`
          return newE
        }))
        
        // Also update steps/triggers state
        setSteps(prev => prev.map(s => idMap.has(s.id) ? { ...s, id: idMap.get(s.id)! } : s))
        setTriggers(prev => prev.map(t => idMap.has(t.id) ? { ...t, id: idMap.get(t.id)! } : t))
      }

      setSaveState("saved")
      onSaved() // trigger parent refresh
    } catch (err: unknown) {
      console.error(err)
      setSaveState("error")
    }
  }

  const handleAddNode = useCallback((type: string, position?: { x: number, y: number }, isTrigger: boolean = false) => {
    if (isTrigger) {
      const newNode: Node = {
        id: `draft-trigger-${Date.now()}`,
        type: 'triggerNode',
        position: position || { x: 250, y: 50 },
        data: {
          id: `draft-trigger-${Date.now()}`,
          trigger_type: type,
          is_active: true,
          config: type === "database_event" ? { table: "workflow_custom_data", operation: "INSERT" } : (type === "scheduled" ? { cron: "*/5 * * * *" } : {}),
          label: type.replace('_', ' '),
          description: 'Workflow trigger'
        }
      }
      setNodes(nds => [...nds, newNode])
      setSaveState('unsaved')
      return;
    }

    // Step logic: find terminal nodes
    const sources = new Set(edges.map(e => e.source))
    const terminals = nodes.filter(n => !sources.has(n.id))
    
    let finalPosition = position;
    let autoConnectSource: Node | null = null;
    
    // Auto-placement logic if no explicit position (click from palette)
    if (!finalPosition) {
       if (terminals.length === 1) {
         const term = terminals[0];
         finalPosition = { x: term.position.x, y: term.position.y + 150 };
       } else {
         const maxY = nodes.length > 0 ? Math.max(...nodes.map(n => n.position.y)) : 50;
         finalPosition = { x: 250, y: maxY + 150 };
       }
    }

    // Determine auto-connect target
    // We auto connect if exactly 1 terminal and it's NOT a conditional node (since conditionals have multiple ambiguous handles)
    if (terminals.length === 1 && terminals[0].type !== 'conditionalNode') {
      autoConnectSource = terminals[0];
    }

    const newNodeId = `draft-step-${Date.now()}`
    const newNode: Node = {
      id: newNodeId,
      type: type === 'conditional_branch' ? 'conditionalNode' : 'actionNode',
      position: finalPosition,
      data: {
        id: newNodeId,
        step_type: type,
        name: `New ${type.replace('_', ' ')}`,
        config: {},
        label: `New ${type.replace('_', ' ')}`,
        description: type.replace('_', ' ')
      }
    }
    
    setNodes(nds => [...nds, newNode])
    
    if (autoConnectSource) {
      setEdges(eds => [...eds, {
        id: `e-${autoConnectSource!.id}-${newNodeId}`,
        source: autoConnectSource!.id,
        target: newNodeId
      }])
    }
    
    setSaveState('unsaved')
  }, [nodes, edges, setNodes, setEdges])

  return (
    <div className="relative flex flex-col h-full min-h-0 min-w-0">
      <div className="flex-none px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <WorkflowToolbar 
          name={initialWorkflow.name}
          isDraft={!initialWorkflow.is_active}
          updatedAt={initialWorkflow.updated_at}
          stepCount={steps.length}
          triggerTypes={triggers.map(t => t.trigger_type)}
          saveState={saveState}
          onSave={persistChanges}
          onRun={() => {}}
          canEdit={canEdit}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Palette */}
        <div className="w-64 border-r bg-muted/10 hidden md:block">
          <WorkflowNodePalette 
            canEdit={canEdit} 
            hasTrigger={nodes.some(n => n.type === 'triggerNode')}
            onAddTrigger={(type) => handleAddNode(type, undefined, true)}
            onAddStep={(type) => handleAddNode(type, undefined, false)}
          />
        </div>

        {/* Center Canvas */}
        <div className="flex-1 h-full">
          <WorkflowCanvas 
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onAddNode={handleAddNode}
            onDeleteEdge={(edgeId) => {
              setEdges(eds => eds.filter(e => e.id !== edgeId))
              setSaveState('unsaved')
            }}
          />
        </div>

        {/* Right Inspector */}
        <div 
          className={`border-l bg-background hidden lg:block overflow-y-auto shrink-0 transition-all duration-300 ease-in-out ${
            nodes.some(n => n.selected) ? 'w-80 border-l' : 'w-0 border-transparent border-l-0 overflow-hidden'
          }`}
        >
          <div className="w-80 h-full">
            <WorkflowInspector 
              selectedNode={nodes.find(n => n.selected) || null}
              canEdit={canEdit}
              onSaveNode={(nodeId, data) => {
                setNodes(nds => nds.map(n => {
                  if (n.id === nodeId) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        ...data,
                        label: data.name || (data.trigger_type ? data.trigger_type.replace('_', ' ') : n.data.label)
                      }
                    }
                  }
                  return n
                }))
                setSaveState('unsaved')
              }}
              onDeleteNode={(nodeId) => {
                setNodes(nds => nds.filter(n => n.id !== nodeId))
                setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
                setSaveState('unsaved')
              }}
              onClose={() => {
                // Deselect all nodes to close inspector
                setNodes(nds => nds.map(n => ({ ...n, selected: false })))
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
