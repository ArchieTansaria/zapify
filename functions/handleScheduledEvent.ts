import { Request, Response } from 'express';
import { executeAdminQuery } from './workflow/persistence';
import { runWorkflow } from './workflow/runner';
import crypto from 'crypto';
const parser = require('cron-parser');

export default async function handleScheduledEvent(req: Request, res: Response) {
  if (req.headers['x-nhost-webhook-secret'] !== process.env.NHOST_WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  const payload = req.body.payload;
  if (!payload || !payload.trigger_id || !payload.scheduled_run_id) {
    return res.status(400).send('Invalid event payload');
  }

  const triggerId = payload.trigger_id;
  const eventRunId = payload.scheduled_run_id;

  try {
    // 1. Fetch trigger
    const query = `
      query GetTrigger($id: uuid!) {
        workflow_triggers_by_pk(id: $id) {
          id
          workflow_id
          trigger_type
          is_active
          config
          workflow {
            org_id
          }
        }
      }
    `;
    const resTrigger = await executeAdminQuery(query, { id: triggerId });
    const trigger = resTrigger.workflow_triggers_by_pk;

    if (!trigger) {
      console.log(`Scheduled trigger ${triggerId} not found. Skipping.`);
      return res.status(200).send('Trigger not found');
    }

    if (!trigger.is_active || trigger.trigger_type !== 'scheduled') {
      console.log(`Trigger ${triggerId} is not an active scheduled trigger. Skipping.`);
      return res.status(200).send('Trigger inactive');
    }

    const currentRunId = trigger.config?.scheduled_run_id;
    if (currentRunId !== eventRunId) {
      console.log(`Stale scheduled event for trigger ${triggerId}. Expected ${currentRunId}, got ${eventRunId}. Skipping.`);
      return res.status(200).send('Stale event');
    }

    const cronExpr = trigger.config?.cron;
    if (!cronExpr) {
      console.log(`Trigger ${triggerId} missing cron expression. Skipping.`);
      return res.status(200).send('Missing cron');
    }

    const orgId = trigger.workflow?.org_id;
    
    // 2. Execute workflow
    console.log(`Executing scheduled workflow ${trigger.workflow_id}...`);
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
      trigger_type: "scheduled"
    });
    const runId = runRes.insert_workflow_runs_one.id;
    await runWorkflow(runId, trigger.workflow_id, orgId, {});

    // 3. Chain next scheduled event
    const interval = parser.CronExpressionParser.parse(cronExpr);
    const nextDate = interval.next().toDate();
    const nextScheduledRunId = crypto.randomUUID();

    const metadataRequest = {
      type: "create_scheduled_event",
      args: {
        webhook: "{{NHOST_FUNCTIONS_URL}}/handleScheduledEvent",
        schedule_at: nextDate.toISOString(),
        payload: {
          trigger_id: triggerId,
          scheduled_run_id: nextScheduledRunId
        }
      }
    };

    const metadataUrl = process.env.NHOST_HASURA_URL!.replace('/console', '/v1/metadata');
    const metadataResponse = await fetch(metadataUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': process.env.NHOST_ADMIN_SECRET!
      },
      body: JSON.stringify(metadataRequest)
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error(`Failed to chain next scheduled event: ${errorText}`);
      throw new Error(`Metadata API error: ${metadataResponse.status}`);
    }

    console.log(`Chained next event for trigger ${triggerId} at ${nextDate.toISOString()}`);

    // 4. Update trigger config with new ID
    const newConfig = { ...trigger.config, scheduled_run_id: nextScheduledRunId };
    const updateQuery = `
      mutation UpdateTriggerConfig($id: uuid!, $config: jsonb!) {
        update_workflow_triggers_by_pk(pk_columns: { id: $id }, _set: { config: $config }) {
          id
        }
      }
    `;
    await executeAdminQuery(updateQuery, { id: triggerId, config: newConfig });

    return res.status(200).send('Scheduled tick processed');
  } catch (err: any) {
    console.error(`Failed to handle scheduled event ${eventRunId}:`, err);
    return res.status(500).send('Internal Error');
  }
}
