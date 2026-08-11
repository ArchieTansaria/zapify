import { Request, Response } from 'express';
import { executeAdminQuery } from './workflow/persistence';
import { runWorkflow } from './workflow/runner';

export default async function handleDatabaseEvent(req: Request, res: Response) {
  if (req.headers['x-nhost-webhook-secret'] !== process.env.NHOST_WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  const payload = req.body;
  if (!payload || !payload.event || !payload.table || !payload.id) {
    return res.status(400).send('Invalid event payload');
  }

  const eventId = payload.id;
  const tableName = payload.table.name;
  const operation = payload.event.op;
  const rowData = payload.event.data.new;
  const oldData = payload.event.data.old;

  try {
    // 1. Idempotency Check
    const claimQuery = `
      mutation ClaimEvent($event_id: uuid!) {
        insert_processed_events_one(object: { event_id: $event_id }, on_conflict: { constraint: processed_events_pkey, update_columns: [] }) {
          event_id
        }
      }
    `;
    const claimRes = await executeAdminQuery(claimQuery, { event_id: eventId });
    if (!claimRes.insert_processed_events_one) {
      console.log(`Database Event ${eventId} already processed. Skipping.`);
      return res.status(200).send('Already processed');
    }

    // 2. Recursion/Depth Protection
    // If the row was inserted/updated by a workflow (has a step_run_id), check if that workflow was started by a database_event
    if (rowData && rowData.step_run_id) {
      const stepQuery = `
        query GetStepRunContext($step_run_id: uuid!) {
          step_runs_by_pk(id: $step_run_id) {
            workflow_run {
              trigger_type
            }
          }
        }
      `;
      const stepRes = await executeAdminQuery(stepQuery, { step_run_id: rowData.step_run_id });
      const parentTriggerType = stepRes.step_runs_by_pk?.workflow_run?.trigger_type;
      
      if (parentTriggerType === 'database_event') {
        console.log(`Recursion protection: Event ${eventId} originated from a workflow that was itself triggered by a database_event. Skipping.`);
        return res.status(200).send('Recursion blocked');
      }
    }

    // 3. Determine Org ID
    let orgId = null;
    if (tableName === 'workflow_custom_data') {
      if (!rowData.workflow_id) {
         console.warn(`Event ${eventId} has no workflow_id. Cannot determine org. Skipping.`);
         return res.status(200).send('No org_id resolved');
      }
      const wfQuery = `
        query GetWorkflowOrg($workflow_id: uuid!) {
          workflows_by_pk(id: $workflow_id) {
            org_id
          }
        }
      `;
      const wfRes = await executeAdminQuery(wfQuery, { workflow_id: rowData.workflow_id });
      orgId = wfRes.workflows_by_pk?.org_id;
    } else if (tableName === 'workflows') {
      orgId = rowData.org_id;
    }

    if (!orgId) {
      console.warn(`Event ${eventId} could not resolve org_id for table ${tableName}. Skipping.`);
      return res.status(200).send('No org_id resolved');
    }

    // 4. Match Triggers
    const matchQuery = `
      query MatchDatabaseEventTriggers($org_id: uuid!) {
        workflow_triggers(where: {
          trigger_type: { _eq: "database_event" },
          is_active: { _eq: true },
          workflow: { org_id: { _eq: $org_id }, is_active: { _eq: true } }
        }) {
          id
          workflow_id
          config
        }
      }
    `;
    const matchRes = await executeAdminQuery(matchQuery, { org_id: orgId });
    const potentialTriggers = matchRes.workflow_triggers || [];

    const activeTriggers = potentialTriggers.filter((t: any) => {
      const config = t.config || {};
      return config.table === tableName && config.operation === operation;
    });

    if (activeTriggers.length === 0) {
      console.log(`Event ${eventId}: No matching triggers in org ${orgId}.`);
      return res.status(200).send('No matching triggers');
    }

    // 5. Execute Workflows
    console.log(`Event ${eventId}: Triggering ${activeTriggers.length} workflows.`);
    for (const trigger of activeTriggers) {
      // Create workflow run
      const runQuery = `
        mutation CreateRun($workflow_id: uuid!, $trigger_type: trigger_type!) {
          insert_workflow_runs_one(object: {
            workflow_id: $workflow_id,
            status: "running",
            trigger_type: $trigger_type
          }) {
            id
          }
        }
      `;
      const runRes = await executeAdminQuery(runQuery, {
        workflow_id: trigger.workflow_id,
        trigger_type: "database_event"
      });
      const runId = runRes.insert_workflow_runs_one.id;

      // Invoke runner with row data as payload
      await runWorkflow(runId, trigger.workflow_id, orgId, rowData);
    }

    return res.status(200).send('Processed');
  } catch (err: any) {
    console.error(`Failed to process database event ${eventId}:`, err);
    return res.status(500).send('Internal Error');
  }
}
