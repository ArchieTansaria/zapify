import { nhost } from "@/lib/nhost"
import { createClient } from "graphql-ws"

export interface WorkflowStep {
  id: string
  name: string
  step_type: string
  config: Record<string, unknown>
  step_order: number
}

export interface StepRun {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_for_approval'
  step_order: number
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  workflow_step_id?: string
  workflow_step: WorkflowStep
}

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
    workflow_steps?: WorkflowStep[]
    workflow_triggers?: {
      id: string
      trigger_type: string
      config: Record<string, unknown>
      is_active: boolean
    }[]
  }
  step_runs?: StepRun[]
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

const GET_RUN_DETAILS = `
  query GetWorkflowRunDetails($runId: uuid!) {
    workflow_runs_by_pk(id: $runId) {
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
        workflow_steps(order_by: { step_order: asc }) {
          id
          name
          step_type
          config
          step_order
        }
        workflow_triggers {
          id
          trigger_type
          config
          is_active
        }
      }
      step_runs(order_by: { step_order: asc }) {
        id
        status
        step_order
        input
        output
        error
        started_at
        completed_at
        workflow_step {
          id
          name
          step_type
          config
          step_order
        }
      }
    }
  }
`

const APPROVE_STEP_MUTATION = `
  mutation ApproveStep($stepRunId: uuid!) {
    approveStep(step_run_id: $stepRunId) {
      success
    }
  }
`

const SUBSCRIBE_RUN_DETAILS = `
  subscription SubscribeWorkflowRunDetails($runId: uuid!) {
    workflow_runs_by_pk(id: $runId) {
      id
      status
      started_at
      completed_at
      error
      step_runs(order_by: { step_order: asc }) {
        id
        status
        step_order
        input
        output
        error
        started_at
        completed_at
        workflow_step_id
      }
    }
  }
`

export async function fetchRuns(orgId: string): Promise<WorkflowRun[]> {
  const res = await nhost.graphql.request({ query: GET_RUNS, variables: { orgId } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { workflow_runs?: WorkflowRun[] })?.workflow_runs || []
}

export async function fetchRunDetails(runId: string): Promise<WorkflowRun | null> {
  const res = await nhost.graphql.request({ query: GET_RUN_DETAILS, variables: { runId } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { workflow_runs_by_pk?: WorkflowRun })?.workflow_runs_by_pk || null
}

export async function approveStepRun(stepRunId: string): Promise<boolean> {
  const res = await nhost.graphql.request({ query: APPROVE_STEP_MUTATION, variables: { stepRunId } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return !!(res.body.data as { approveStep?: { success: boolean } })?.approveStep?.success
}

export interface TriggerWorkflowRunResult {
  success: boolean
  run_id: string | null
  status: string | null
}

const TRIGGER_WORKFLOW_RUN = `
  mutation TriggerWorkflowRun($workflowId: uuid!) {
    triggerWorkflowRun(workflow_id: $workflowId) {
      success
      run_id
      status
    }
  }
`

export async function triggerWorkflowRun(workflowId: string): Promise<TriggerWorkflowRunResult> {
  const res = await nhost.graphql.request({ query: TRIGGER_WORKFLOW_RUN, variables: { workflowId } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  const result = (res.body.data as { triggerWorkflowRun?: TriggerWorkflowRunResult })?.triggerWorkflowRun
  if (!result) throw new Error('No response from triggerWorkflowRun')
  return result
}

export function subscribeToRunDetails(
  runId: string,
  onNext: (data: Record<string, unknown>) => void,
  onError: (error: unknown) => void,
  onComplete: () => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphqlClient = nhost.graphql as any
  const wsUrl = (graphqlClient.httpUrl || graphqlClient.url).replace(/^http/, 'ws')
  
  const wsClient = createClient({
    url: wsUrl,
    connectionParams: () => {
      const session = nhost.sessionStorage.get()
      const token = session?.accessToken
      return {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      }
    }
  })

  const unsubscribe = wsClient.subscribe(
    {
      query: SUBSCRIBE_RUN_DETAILS,
      variables: { runId }
    },
    {
      next: (data) => onNext(data.data as Record<string, unknown>),
      error: (err) => onError(err),
      complete: () => onComplete(),
    }
  )

  return () => {
    unsubscribe()
    wsClient.dispose()
  }
}
