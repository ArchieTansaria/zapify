import { Request, Response } from 'express';

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
    console.error(`GraphQL fetch failed with status: ${res.status}`);
    throw new Error('Failed to execute admin query');
  }
  
  const json = await res.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors));
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

    const workflowId = input?.workflow_id;
    if (!workflowId) {
      return res.status(400).json({ message: 'Bad request: workflow_id is required' });
    }

    // 1. Fetch workflow and verify authorization and quota in one go.
    const query = `
      query CheckWorkflowAndQuota($workflow_id: uuid!, $user_id: uuid!) {
        workflows_by_pk(id: $workflow_id) {
          id
          org_id
          organization {
            quota_limit
            quota_used
            org_members(where: {user_id: {_eq: $user_id}}) {
              role
            }
          }
        }
      }
    `;

    const data = await executeAdminQuery(query, {
      workflow_id: workflowId,
      user_id: userId
    });

    const workflow = data.workflows_by_pk;

    if (!workflow) {
      // Return generic error if not found or no access
      return res.status(404).json({ message: 'Workflow not found or unauthorized' });
    }

    const members = workflow.organization.org_members;
    if (!members || members.length === 0) {
      // User is not in the org
      return res.status(403).json({ message: 'Workflow not found or unauthorized' });
    }

    const role = members[0].role;
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ message: 'Permission denied: must be owner or editor' });
    }

    const quotaUsed = workflow.organization.quota_used;
    const quotaLimit = workflow.organization.quota_limit;

    // We check quota_used < quota_limit. 
    // CONCURRENCY NOTE: If two requests arrive simultaneously, they both check the quota here 
    // and might both pass, since we do not immediately increment quota_used. Quota is incremented 
    // upon workflow completion by the execution engine, so simultaneous triggers can temporarily 
    // exceed quota constraints. This behavior is intentionally accepted for this milestone.
    if (quotaUsed >= quotaLimit) {
      return res.status(402).json({ message: 'Quota exhausted' });
    }

    // 2. Create the workflow_run.
    const mutation = `
      mutation CreateWorkflowRun($workflow_id: uuid!, $user_id: uuid!) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflow_id,
          triggered_by: $user_id,
          status: "running",
          trigger_type: "manual"
        }) {
          id
          status
        }
      }
    `;

    const mutationData = await executeAdminQuery(mutation, {
      workflow_id: workflowId,
      user_id: userId
    });

    const run = mutationData.insert_workflow_runs_one;

    return res.status(200).json({
      success: true,
      run_id: run.id,
      status: run.status
    });

  } catch (error) {
    console.error('[triggerWorkflowRun] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
