import { nhost } from "@/lib/nhost"

export interface WorkflowRun {
  id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  trigger_type: 'manual' | 'webhook' | 'scheduled' | 'database_event'
  started_at: string | null
  completed_at: string | null
  error: string | null
  created_at: string
  workflow: {
    id: string
    name: string
  }
}

const GET_RUNS = `
  query GetWorkflowRuns($orgId: uuid!) {
    workflow_runs(
      where: { workflow: { org_id: { _eq: $orgId } } },
      order_by: { created_at: desc }
    ) {
      id
      status
      trigger_type
      started_at
      completed_at
      error
      created_at
      workflow {
        id
        name
      }
    }
  }
`

export async function fetchRuns(orgId: string): Promise<WorkflowRun[]> {
  const res = await nhost.graphql.request({ query: GET_RUNS, variables: { orgId } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { workflow_runs?: WorkflowRun[] })?.workflow_runs || []
}
