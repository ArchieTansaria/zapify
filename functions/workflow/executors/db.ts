import { WorkflowStep, ExecutionContext } from '../types';
import { executeAdminQuery } from '../persistence';

export async function executeDbWrite(step: WorkflowStep, ctx: ExecutionContext): Promise<any> {
  // Simple payload extraction from config or fallback to previous output
  let dataToSave = step.config?.payload || ctx.previousOutput || {};

  // Simple templating replacement for {{previous_output}}
  if (typeof dataToSave === 'string') {
    if (dataToSave.includes('{{previous_output}}')) {
      const prevOutputStr = typeof ctx.previousOutput === 'object' ? JSON.stringify(ctx.previousOutput) : String(ctx.previousOutput || '');
      // Try replacing raw string for simple cases
      dataToSave = dataToSave.replace('{{previous_output}}', prevOutputStr);
      try {
        dataToSave = JSON.parse(dataToSave);
      } catch (e) {
        // keep as string if not valid JSON
      }
    }
  } else if (typeof dataToSave === 'object' && dataToSave !== null) {
    // If it's an object containing {{previous_output}}, do a deep stringify replace
    let strData = JSON.stringify(dataToSave);
    if (strData.includes('{{previous_output}}')) {
       // Only do simple string replacement if safe. To avoid JSON injection, 
       // it's tricky to blindly replace within stringified JSON.
       // We'll leave the object logic simple: if it's explicitly {{previous_output}}, swap it.
       for (const key in dataToSave) {
         if (dataToSave[key] === '{{previous_output}}') {
           dataToSave[key] = ctx.previousOutput;
         }
       }
    }
  }

  // Ensure data is an object for jsonb column, or wrap it
  if (typeof dataToSave !== 'object' || dataToSave === null) {
    dataToSave = { value: dataToSave };
  }

  const query = `
    mutation InsertCustomData($orgId: uuid!, $workflowId: uuid!, $data: jsonb!) {
      insert_workflow_custom_data_one(object: {
        org_id: $orgId,
        workflow_id: $workflowId,
        data: $data
      }) {
        id
        created_at
      }
    }
  `;

  const variables = {
    orgId: ctx.orgId,
    workflowId: ctx.workflowId,
    data: dataToSave
  };

  const res = await executeAdminQuery(query, variables);
  
  if (!res.insert_workflow_custom_data_one) {
    throw new Error('Failed to insert workflow_custom_data');
  }

  return {
    id: res.insert_workflow_custom_data_one.id,
    status: 'success',
    saved_data: dataToSave
  };
}
