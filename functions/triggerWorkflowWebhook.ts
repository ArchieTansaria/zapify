import { Request, Response } from 'express';
import { runWorkflow } from './workflow/runner';
import * as crypto from 'crypto';

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
    const secret = req.headers['x-zapify-webhook-secret'];
    if (!secret || typeof secret !== 'string') {
      return res.status(401).json({ message: 'Unauthorized: missing or invalid webhook secret' });
    }

    const input = req.body.input;
    const workflowId = input?.workflow_id;
    const payload = input?.payload;

    if (!workflowId) {
      return res.status(400).json({ message: 'Bad request: workflow_id is required' });
    }

    // Hash the incoming secret
    const incomingHash = crypto.createHash('sha256').update(secret).digest('hex');

    // 1. Fetch workflow and triggers and verify quota
    const query = `
      query GetWorkflowForWebhook($workflow_id: uuid!) {
        workflows_by_pk(id: $workflow_id) {
          id
          org_id
          is_active
          organization {
            id
            quota_limit
            quota_used
          }
          workflow_triggers(where: {trigger_type: {_eq: "webhook"}, is_active: {_eq: true}}) {
            config
          }
        }
      }
    `;

    const data = await executeAdminQuery(query, {
      workflow_id: workflowId
    });

    const workflow = data.workflows_by_pk;

    // To prevent leaking whether a workflow exists, return generic error
    if (!workflow || !workflow.is_active || workflow.workflow_triggers.length === 0) {
      return res.status(404).json({ message: 'Workflow not found, inactive, or no webhook trigger configured' });
    }

    // Verify the secret
    // Note: The config might have a 'secret' or 'secretHash' property. We'll use 'secretHash'
    const config = workflow.workflow_triggers[0].config;
    let storedHash;
    if (typeof config === 'string') {
      try {
        const parsed = JSON.parse(config);
        storedHash = parsed.secretHash;
      } catch(e) {}
    } else {
      storedHash = config?.secretHash;
    }
    console.log("Debug webhook config:", config, "Stored hash:", storedHash);
    
    if (!storedHash) {
      return res.status(401).json({ message: 'Unauthorized: webhook secret misconfigured' });
    }

    // Constant-time comparison
    try {
      const incomingBuf = Buffer.from(incomingHash);
      const storedBuf = Buffer.from(storedHash);
      if (incomingBuf.length !== storedBuf.length || !crypto.timingSafeEqual(incomingBuf, storedBuf)) {
        return res.status(401).json({ message: 'Unauthorized: invalid webhook secret' });
      }
    } catch (e) {
      return res.status(401).json({ message: 'Unauthorized: invalid webhook secret' });
    }

    const quotaUsed = workflow.organization.quota_used;
    const quotaLimit = workflow.organization.quota_limit;

    if (quotaUsed >= quotaLimit) {
      return res.status(402).json({ message: 'Quota exhausted' });
    }

    // 2. Create the workflow_run.
    const mutation = `
      mutation CreateWebhookRun($workflow_id: uuid!) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflow_id,
          status: "running",
          trigger_type: "webhook"
        }) {
          id
          status
        }
      }
    `;

    const mutationData = await executeAdminQuery(mutation, {
      workflow_id: workflowId
    });

    const run = mutationData.insert_workflow_runs_one;

    // 3. Execute Workflow Asynchronously with payload
    // Await it so function execution does not get dropped
    await runWorkflow(run.id, workflow.id, workflow.organization.id, undefined, payload);

    return res.status(200).json({
      success: true,
      run_id: run.id,
      status: run.status
    });

  } catch (error) {
    console.error('[triggerWorkflowWebhook] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
