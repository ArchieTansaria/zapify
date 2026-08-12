'use client'

import { useCallback, useState } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  OnNodesChange,
  OnEdgesChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { TriggerNode } from './nodes/trigger-node'
import { ActionNode } from './nodes/action-node'
import { ConditionalNode } from './nodes/conditional-node'
import { DeletableEdge } from './edges/deletable-edge'

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionalNode: ConditionalNode,
}

const edgeTypes = {
  deletable: DeletableEdge
}

interface WorkflowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange<Node>
  onEdgesChange: OnEdgesChange<Edge>
  onConnect: (connection: Connection | Edge) => void
  onAddNode?: (type: string, position: { x: number, y: number }, isTrigger: boolean) => void
  onDeleteEdge?: (edgeId: string) => void
}

export function WorkflowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onAddNode, onDeleteEdge }: WorkflowCanvasProps) {
  const [rfInstance, setRfInstance] = useState<any>(null)

  const edgesWithData = edges.map(edge => ({
    ...edge,
    data: {
      ...edge.data,
      onDelete: onDeleteEdge
    }
  }))

  const handleConnect = useCallback(
    (params: Connection | Edge) => {
      const edge: Edge = {
        ...params,
        id: 'id' in params ? params.id : `e-${params.source}-${params.target}-${Date.now()}`
      } as Edge

      if (params.sourceHandle === 'true') edge.style = { stroke: '#22c55e' }
      if (params.sourceHandle === 'false') edge.style = { stroke: '#ef4444' }
      
      onConnect(edge)
    },
    [onConnect]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!rfInstance || !onAddNode) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const isTriggerStr = event.dataTransfer.getData('application/reactflow/isTrigger');
      
      if (!type) {
        return;
      }

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onAddNode(type, position, isTriggerStr === 'true');
    },
    [rfInstance, onAddNode],
  );

  const hasTrigger = nodes.some(n => n.type === 'triggerNode')

  return (
    <div className="w-full h-full flex-grow relative" style={{ minHeight: '600px' }} onDragOver={onDragOver} onDrop={onDrop}>
      {!hasTrigger && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-background/95 backdrop-blur border p-6 rounded-lg shadow-sm text-center max-w-sm">
            <h3 className="font-semibold text-lg mb-2">No trigger configured</h3>
            <p className="text-sm text-muted-foreground">
              Drag a trigger from the node palette to start building this workflow.
            </p>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edgesWithData}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'deletable' }}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        className="bg-background"
        colorMode="dark"
      >
        <Controls />
        <MiniMap 
          nodeStrokeColor={(n) => {
            if (n.type === 'triggerNode') return '#3b82f6'
            if (n.type === 'conditionalNode') return '#f97316'
            return '#71717a'
          }}
          nodeColor={(n) => {
            return 'transparent'
          }}
          maskColor="rgba(0,0,0,0.2)"
          style={{ backgroundColor: 'hsl(var(--card))' }}
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--muted-foreground))" />
      </ReactFlow>
    </div>
  )
}
