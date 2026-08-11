import { nhost } from "@/lib/nhost"

export interface WorkflowStep {
  id: string
  step_type: string
  name: string
  config: Record<string, unknown>
  step_order: number
}

export interface WorkflowTrigger {
  id: string
  trigger_type: string
  config: Record<string, unknown>
  is_active: boolean
}

export interface Workflow {
  id: string
  org_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  workflow_steps?: WorkflowStep[]
  workflow_triggers?: WorkflowTrigger[]
}

const GET_WORKFLOWS = `
  query GetWorkflows($orgId: uuid!) {
    workflows(where: { org_id: { _eq: $orgId } }, order_by: { updated_at: desc, created_at: desc }) {
      id
      name
      description
      is_active
      created_at
      updated_at
      workflow_steps(order_by: { step_order: asc }) {
        id
        step_type
        name
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
  }
`

const GET_WORKFLOW = `
  query GetWorkflow($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      org_id
      name
      description
      is_active
      created_at
      updated_at
      workflow_steps(order_by: { step_order: asc }) {
        id
        step_type
        name
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
  }
`

const CREATE_WORKFLOW = `
  mutation CreateWorkflow($orgId: uuid!, $name: String!) {
    insert_workflows_one(object: { org_id: $orgId, name: $name }) {
      id
      name
    }
  }
`

const UPDATE_WORKFLOW = `
  mutation UpdateWorkflow($id: uuid!, $name: String!) {
    update_workflows_by_pk(pk_columns: { id: $id }, _set: { name: $name }) {
      id
      name
    }
  }
`

const DELETE_WORKFLOW = `
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`

export async function fetchWorkflows(orgId: string): Promise<Workflow[]> {
  const res = await nhost.graphql.request({ query: GET_WORKFLOWS, variables: { orgId } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { workflows?: Workflow[] })?.workflows || []
}

export async function fetchWorkflow(id: string): Promise<Workflow | null> {
  const res = await nhost.graphql.request({ query: GET_WORKFLOW, variables: { id } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { workflows_by_pk?: Workflow | null })?.workflows_by_pk || null
}

export async function createWorkflow(orgId: string, name: string): Promise<Workflow> {
  const res = await nhost.graphql.request({ query: CREATE_WORKFLOW, variables: { orgId, name } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { insert_workflows_one?: Workflow })?.insert_workflows_one as Workflow
}

export async function updateWorkflow(id: string, name: string): Promise<Workflow> {
  const res = await nhost.graphql.request({ query: UPDATE_WORKFLOW, variables: { id, name } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { update_workflows_by_pk?: Workflow })?.update_workflows_by_pk as Workflow
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const res = await nhost.graphql.request({ query: DELETE_WORKFLOW, variables: { id } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return !!(res.body.data as { delete_workflows_by_pk?: unknown })?.delete_workflows_by_pk
}

export async function createWorkflowStep(workflowId: string, type: string, name: string, order: number, config: Record<string, unknown> = {}) {
  const query = `
    mutation CreateStep($workflowId: uuid!, $type: step_type!, $name: String!, $order: Int!, $config: jsonb!) {
      insert_workflow_steps_one(object: { workflow_id: $workflowId, step_type: $type, name: $name, step_order: $order, config: $config }) {
        id
        step_type
        name
        step_order
        config
      }
    }
  `
  const res = await nhost.graphql.request({ query, variables: { workflowId, type, name, order, config } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { insert_workflow_steps_one?: WorkflowStep })?.insert_workflow_steps_one
}

export async function updateWorkflowStep(id: string, name: string, config: Record<string, unknown>, order: number) {
  const query = `
    mutation UpdateStep($id: uuid!, $name: String!, $config: jsonb!, $order: Int!) {
      update_workflow_steps_by_pk(pk_columns: { id: $id }, _set: { name: $name, config: $config, step_order: $order }) {
        id
        step_type
        name
        step_order
        config
      }
    }
  `
  const res = await nhost.graphql.request({ query, variables: { id, name, config, order } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { update_workflow_steps_by_pk?: WorkflowStep })?.update_workflow_steps_by_pk
}

export async function deleteWorkflowStep(id: string) {
  const query = `
    mutation DeleteStep($id: uuid!) {
      delete_workflow_steps_by_pk(id: $id) {
        id
      }
    }
  `
  const res = await nhost.graphql.request({ query, variables: { id } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return !!(res.body.data as { delete_workflow_steps_by_pk?: unknown })?.delete_workflow_steps_by_pk
}

export async function createWorkflowTrigger(workflowId: string, type: string, config: Record<string, unknown> = {}) {
  const query = `
    mutation CreateTrigger($workflowId: uuid!, $type: trigger_type!, $config: jsonb!) {
      insert_workflow_triggers_one(object: { workflow_id: $workflowId, trigger_type: $type, config: $config }) {
        id
        trigger_type
        config
        is_active
      }
    }
  `
  const res = await nhost.graphql.request({ query, variables: { workflowId, type, config } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { insert_workflow_triggers_one?: WorkflowTrigger })?.insert_workflow_triggers_one
}

export async function updateWorkflowTrigger(id: string, config: Record<string, unknown>, isActive: boolean = true) {
  const query = `
    mutation UpdateTrigger($id: uuid!, $config: jsonb!, $isActive: Boolean!) {
      update_workflow_triggers_by_pk(pk_columns: { id: $id }, _set: { config: $config, is_active: $isActive }) {
        id
        trigger_type
        config
        is_active
      }
    }
  `
  const res = await nhost.graphql.request({ query, variables: { id, config, isActive } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return (res.body.data as { update_workflow_triggers_by_pk?: WorkflowTrigger })?.update_workflow_triggers_by_pk
}

export async function deleteWorkflowTrigger(id: string) {
  const query = `
    mutation DeleteTrigger($id: uuid!) {
      delete_workflow_triggers_by_pk(id: $id) {
        id
      }
    }
  `
  const res = await nhost.graphql.request({ query, variables: { id } })
  if (res.body.errors) throw new Error(res.body.errors[0].message)
  return !!(res.body.data as { delete_workflow_triggers_by_pk?: unknown })?.delete_workflow_triggers_by_pk
}
