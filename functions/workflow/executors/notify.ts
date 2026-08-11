import { WorkflowStep, ExecutionContext } from '../types';
import { executeAdminQuery } from '../persistence';

export async function executeNotify(step: WorkflowStep, ctx: ExecutionContext): Promise<any> {
  let targetUrl = step.config?.target_url;
  let message = step.config?.message || 'Workflow notification';

  if (!targetUrl) {
    throw new Error('Missing target_url in notify step config');
  }

  // Simple template replacement
  if (message.includes('{{previous_output}}')) {
    const prevOutputStr = typeof ctx.previousOutput === 'object' ? JSON.stringify(ctx.previousOutput) : String(ctx.previousOutput || '');
    message = message.replace('{{previous_output}}', prevOutputStr);
  }

  const query = `
    mutation InsertNotification($orgId: uuid!, $runId: uuid!, $target: String!, $message: String!) {
      insert_notifications_one(object: {
        org_id: $orgId,
        workflow_run_id: $runId,
        target: $target,
        message: $message,
        status: "pending"
      }) {
        id
        status
      }
    }
  `;

  const variables = {
    orgId: ctx.orgId,
    runId: ctx.workflowRunId,
    target: targetUrl,
    message: message
  };

  const res = await executeAdminQuery(query, variables);
  
  if (!res.insert_notifications_one) {
    throw new Error('Failed to insert notification into queue');
  }

  return {
    id: res.insert_notifications_one.id,
    status: 'queued',
    message: 'Notification queued for delivery'
  };
}
