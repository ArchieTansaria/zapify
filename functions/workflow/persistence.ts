import { WorkflowStep, StepRun, StepRunStatus } from './types';

const GRAPHQL_URL = process.env.HASURA_GRAPHQL_GRAPHQL_URL || 'http://graphql:8080/v1/graphql';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET as string;

export async function executeAdminQuery(query: string, variables: any = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET
    },
    body: JSON.stringify({ query, variables })
  });
  
  if (!res.ok) {
    throw new Error(`GraphQL fetch failed with status: ${res.status}`);
  }
  
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL query returned errors: ${JSON.stringify(json.errors)}`);
  }
  
  return json.data;
}

export async function loadWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
  const query = `
    query GetSteps($workflow_id: uuid!) {
      workflow_steps(where: {workflow_id: {_eq: $workflow_id}}, order_by: {step_order: asc}) {
        id
        workflow_id
        step_type
        name
        config
        step_order
      }
    }
  `;
  const data = await executeAdminQuery(query, { workflow_id: workflowId });
  return data.workflow_steps;
}

export async function createStepRun(
  workflowRunId: string, 
  stepId: string, 
  stepOrder: number, 
  input: any,
  status: StepRunStatus = 'running'
): Promise<string> {
  const mutation = `
    mutation CreateStepRun($workflow_run_id: uuid!, $workflow_step_id: uuid!, $step_order: Int!, $input: jsonb!, $status: step_run_status!) {
      insert_step_runs_one(object: {
        workflow_run_id: $workflow_run_id,
        workflow_step_id: $workflow_step_id,
        status: $status,
        step_order: $step_order,
        input: $input,
        started_at: "now()"
      }) { id }
    }
  `;
  const data = await executeAdminQuery(mutation, { 
    workflow_run_id: workflowRunId, 
    workflow_step_id: stepId,
    step_order: stepOrder,
    input,
    status
  });
  return data.insert_step_runs_one.id;
}

export async function updateStepRun(
  stepRunId: string,
  status: StepRunStatus,
  output: any,
  error: string | null,
  attemptCount: number
) {
  const mutation = `
    mutation UpdateStepRun($id: uuid!, $status: step_run_status!, $output: jsonb, $error: String, $attempt_count: Int!) {
      update_step_runs_by_pk(
        pk_columns: {id: $id},
        _set: {
          status: $status,
          output: $output,
          error: $error,
          attempt_count: $attempt_count,
          completed_at: ${status === 'completed' || status === 'failed' ? '"now()"' : 'null'}
        }
      ) { id }
    }
  `;
  await executeAdminQuery(mutation, {
    id: stepRunId,
    status,
    output,
    error,
    attempt_count: attemptCount
  });
}

export async function completeWorkflowRun(runId: string, orgId: string) {
  const mutation = `
    mutation CompleteRun($run_id: uuid!, $org_id: uuid!) {
      update_workflow_runs_by_pk(
        pk_columns: {id: $run_id},
        _set: {status: "completed", completed_at: "now()"}
      ) { id }
      
      update_organizations_by_pk(
        pk_columns: {id: $org_id},
        _inc: {quota_used: 1}
      ) { id }
    }
  `;
  await executeAdminQuery(mutation, { run_id: runId, org_id: orgId });
}

export async function failWorkflowRun(runId: string, error: string) {
  const mutation = `
    mutation FailRun($run_id: uuid!, $error: String!) {
      update_workflow_runs_by_pk(
        pk_columns: {id: $run_id},
        _set: {status: "failed", completed_at: "now()", error: $error}
      ) { id }
    }
  `;
  await executeAdminQuery(mutation, { run_id: runId, error });
}

export async function pauseWorkflowRun(runId: string) {
  const mutation = `
    mutation PauseRun($run_id: uuid!) {
      update_workflow_runs_by_pk(
        pk_columns: {id: $run_id},
        _set: {status: "paused"}
      ) { id }
    }
  `;
  await executeAdminQuery(mutation, { run_id: runId });
}

export async function resumeWorkflowRun(runId: string) {
  const mutation = `
    mutation ResumeRun($run_id: uuid!) {
      update_workflow_runs_by_pk(
        pk_columns: {id: $run_id},
        _set: {status: "running"}
      ) { id }
    }
  `;
  await executeAdminQuery(mutation, { run_id: runId });
}

export async function approveStepRun(stepRunId: string, userId: string): Promise<boolean> {
  const mutation = `
    mutation ApproveStepRun($id: uuid!, $user_id: uuid!) {
      update_step_runs(
        where: { id: { _eq: $id }, status: { _eq: "waiting_for_approval" } },
        _set: {
          status: "completed",
          approved_by: $user_id,
          approved_at: "now()",
          completed_at: "now()"
        }
      ) {
        affected_rows
      }
    }
  `;
  const data = await executeAdminQuery(mutation, { id: stepRunId, user_id: userId });
  return data.update_step_runs.affected_rows > 0;
}

export async function getRunContext(runId: string) {
  const query = `
    query GetRunContext($run_id: uuid!) {
      step_runs(
        where: {workflow_run_id: {_eq: $run_id}, status: {_in: ["completed", "failed", "skipped"]}},
        order_by: {step_order: desc},
        limit: 1
      ) {
        output
        input
      }
    }
  `;
  const data = await executeAdminQuery(query, { run_id: runId });
  if (data.step_runs && data.step_runs.length > 0) {
    // Return output of the last completed step. Or for approval_gate, its output might be null, but its input has previousOutput.
    // Wait, approval_gate output is probably null. But we don't care, we can just get the last step run.
    const lastRun = data.step_runs[0];
    return lastRun.output ?? lastRun.input?.previousOutput ?? null;
  }
  return null;
}
