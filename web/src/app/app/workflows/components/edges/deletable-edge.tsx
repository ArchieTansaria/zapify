import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, EdgeProps } from '@xyflow/react'

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-4 h-4 bg-background border rounded-full text-muted-foreground flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors text-[10px] shadow-sm opacity-50 hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              if (data && typeof data.onDelete === 'function') {
                data.onDelete(id);
              }
            }}
            title="Remove connection"
          >
            ✕
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
