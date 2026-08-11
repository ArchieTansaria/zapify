import { Request, Response } from 'express';
import { executeAdminQuery } from './workflow/persistence';
import crypto from 'crypto';
const parser = require('cron-parser');

export default async function syncScheduledTrigger(req: Request, res: Response) {
  if (req.headers['x-nhost-webhook-secret'] !== process.env.NHOST_WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  const payload = req.body;
  if (!payload || !payload.event || !payload.event.data) {
    return res.status(400).send('Invalid event payload');
  }

  const newData = payload.event.data.new;
  const oldData = payload.event.data.old;

  if (!newData) {
    return res.status(200).send('Deleted trigger, skipping.');
  }

  const isScheduled = newData.trigger_type === 'scheduled';
  const isActive = newData.is_active;
  const cronExpr = newData.config?.cron;

  const wasScheduled = oldData?.trigger_type === 'scheduled';
  const wasActive = oldData?.is_active;
  const oldCronExpr = oldData?.config?.cron;

  const typeChanged = isScheduled && !wasScheduled;
  const activeChanged = isActive && !wasActive;
  const cronChanged = cronExpr !== oldCronExpr;
  const needsInit = !newData.config?.scheduled_run_id;

  if (!isScheduled || !isActive || !cronExpr) {
    console.log(`Trigger ${newData.id} is not an active scheduled trigger. Skipping sync.`);
    return res.status(200).send('Not active scheduled trigger');
  }

  // Only create a new schedule if the configuration meaningfully changed
  if (typeChanged || activeChanged || cronChanged || needsInit) {
    console.log(`Syncing scheduled trigger ${newData.id}...`);
    try {
      // Validate cron
      const interval = parser.CronExpressionParser.parse(cronExpr);
      const nextDate = interval.next().toDate();

      // Generate a new idempotency ID
      const scheduledRunId = crypto.randomUUID();

      // 1. Create Hasura scheduled event via metadata API
      const metadataRequest = {
        type: "create_scheduled_event",
        args: {
          webhook: "{{NHOST_FUNCTIONS_URL}}/handleScheduledEvent",
          schedule_at: nextDate.toISOString(),
          payload: {
            trigger_id: newData.id,
            scheduled_run_id: scheduledRunId
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
        console.error(`Failed to create scheduled event: ${errorText}`);
        throw new Error(`Metadata API error: ${metadataResponse.status}`);
      }

      console.log(`Created scheduled event for trigger ${newData.id} at ${nextDate.toISOString()}`);

      // 2. Persist the new ID back to the trigger config
      const newConfig = { ...newData.config, scheduled_run_id: scheduledRunId };
      const updateQuery = `
        mutation UpdateTriggerConfig($id: uuid!, $config: jsonb!) {
          update_workflow_triggers_by_pk(pk_columns: { id: $id }, _set: { config: $config }) {
            id
          }
        }
      `;
      await executeAdminQuery(updateQuery, { id: newData.id, config: newConfig });
      console.log(`Updated trigger ${newData.id} config with scheduled_run_id ${scheduledRunId}.`);

    } catch (err: any) {
      console.error(`Failed to sync scheduled trigger ${newData.id}:`, err);
      // We don't want to throw and cause a webhook retry loop if the cron is invalid
      return res.status(200).send(`Failed to sync: ${err.message}`);
    }
  }

  return res.status(200).send('Sync complete');
}
