import { Request, Response } from 'express';
import { runWorkflow } from './workflow/runner';
import { resumeWorkflowRun } from './workflow/persistence';

const GRAPHQL_URL = process.env.HASURA_GRAPHQL_GRAPHQL_URL || 'http://graphql:8080/v1/graphql';
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET as string;

async function executeAdminQuery(query: string, variables: any = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET
    },
    body: JSON.stringify({ query, variables })
  });
  
  if (!res.ok) {
    throw new Error('Failed to execute admin query');
  }
  
  const json = await res.json();
  if (json.errors) {
    throw new Error('GraphQL query returned errors');
  }
  
  return json.data;
}

export default async (req: Request, res: Response) => {
  try {
    const { session_variables, input } = req.body;

    if (!session_variables) {
      return res.status(401).json({ message: 'Unauthorized: missing session variables' });
    }

    const userId = session_variables['x-hasura-user-id'];
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: missing user id in session variables' });
    }

    const stepRunId = input?.step_run_id;
    if (!stepRunId) {
      return res.status(400).json({ message: 'Bad request: step_run_id is required' });
    }

    // 1. Fetch step_run details and verify authorization
    const query = `
      query CheckApprovalAuth($step_run_id: uuid!, $user_id: uuid!) {
        step_runs_by_pk(id: $step_run_id) {
          id
          status
          workflow_step_id
          workflow_step {
            step_type
          }
          workflow_run {
            id
            status
            workflow {
              id
              organization {
                id
                org_members(where: {user_id: {_eq: $user_id}}) {
                  role
                }
              }
            }
          }
        }
      }
    `;

    const data = await executeAdminQuery(query, {
      step_run_id: stepRunId,
      user_id: userId
    });

    const stepRun = data.step_runs_by_pk;
    if (!stepRun) {
      return res.status(403).json({ message: 'Approval not permitted' });
    }

    // Verify step type and workflow state
    if (stepRun.workflow_step.step_type !== 'approval_gate') {
      return res.status(403).json({ message: 'Approval not permitted' });
    }
    
    if (stepRun.workflow_run.status !== 'paused') {
      return res.status(403).json({ message: 'Approval not permitted' });
    }

    const org = stepRun.workflow_run.workflow.organization;
    const members = org.org_members;

    if (!members || members.length === 0) {
      return res.status(403).json({ message: 'Approval not permitted' });
    }

    const role = members[0].role;
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ message: 'Approval not permitted' });
    }

    // 2. Perform atomic approval update
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

    const mutationData = await executeAdminQuery(mutation, {
      id: stepRunId,
      user_id: userId
    });

    if (mutationData.update_step_runs.affected_rows === 0) {
      return res.status(400).json({ message: 'Approval gate is no longer awaiting approval' });
    }

    // 3. Resume workflow
    const runId = stepRun.workflow_run.id;
    await resumeWorkflowRun(runId);
    
    // Execute asynchronously (Node in Nhost will wait if we await it, completing the original request safely)
    await runWorkflow(runId, stepRun.workflow_run.workflow.id, org.id, stepRun.workflow_step_id);

    return res.status(200).json({
      success: true,
      run_id: runId,
      status: "running"
    });

  } catch (error) {
    console.error('[approveStep] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
