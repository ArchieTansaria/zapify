import { ExecutionContext, WorkflowStep } from './types';
import { loadWorkflowSteps, createStepRun, updateStepRun, completeWorkflowRun, failWorkflowRun, pauseWorkflowRun, executeAdminQuery } from './persistence';
import { executeLLM } from './executors/llm';
import { executeHttp } from './executors/http';
import { executeConditional } from './executors/conditional';
import { executeDbWrite } from './executors/db';
import { executeNotify } from './executors/notify';
import { executeWithRetry } from './retry';

export async function runWorkflow(workflowRunId: string, workflowId: string, orgId: string, resumeFromStepId?: string, initialPayload?: any) {
  try {
    const steps = await loadWorkflowSteps(workflowId);
    if (steps.length === 0) {
      await completeWorkflowRun(workflowRunId, orgId);
      return;
    }

    const ctx: ExecutionContext = {
      workflowRunId,
      workflowId,
      orgId,
      previousOutput: initialPayload || null,
      steps: {}
    };

    let currentIndex = 0;
    let jumpTargetId: string | undefined = undefined;

    if (resumeFromStepId) {
      // Find the step we are resuming from
      const resumeIndex = steps.findIndex(s => s.id === resumeFromStepId);
      if (resumeIndex === -1) {
        throw new Error(`Resume target step ${resumeFromStepId} not found`);
      }
      
      // Fetch the input payload of the approval_gate step run to reconstruct ctx
      const query = `
        query GetStepRunInput($run_id: uuid!, $step_id: uuid!) {
          step_runs(where: {workflow_run_id: {_eq: $run_id}, workflow_step_id: {_eq: $step_id}}, limit: 1) {
            input
          }
        }
      `;
      const data = await executeAdminQuery(query, { run_id: workflowRunId, step_id: resumeFromStepId });
      if (data.step_runs && data.step_runs.length > 0) {
        const input = data.step_runs[0].input;
        ctx.previousOutput = input?.previousOutput;
        ctx.pendingJoin = input?.pendingJoin;
      }
      
      // Start execution from the step AFTER the approval_gate
      currentIndex = resumeIndex + 1;
    }

    while (currentIndex < steps.length) {
      let step: WorkflowStep;
      
      if (jumpTargetId) {
        const targetIndex = steps.findIndex(s => s.id === jumpTargetId);
        if (targetIndex === -1) {
          throw new Error(`Jump target step ${jumpTargetId} not found`);
        }
        currentIndex = targetIndex;
        jumpTargetId = undefined; // reset
      }

      step = steps[currentIndex];

      const input = { previousOutput: ctx.previousOutput, pendingJoin: ctx.pendingJoin };
      
      if (step.step_type === 'approval_gate') {
        // Special case: Create paused step run, pause workflow run, and terminate function
        await createStepRun(workflowRunId, step.id, step.step_order, input, 'waiting_for_approval');
        await pauseWorkflowRun(workflowRunId);
        return; // Pause execution
      }

      const stepRunId = await createStepRun(workflowRunId, step.id, step.step_order, input);

      let resultObj: { result?: any, error?: string, attempts: number };

      if (step.step_type === 'llm_call') {
        resultObj = await executeWithRetry(() => executeLLM(step, ctx), 3);
      } else if (step.step_type === 'http_request') {
        resultObj = await executeWithRetry(() => executeHttp(step, ctx), 3);
      } else if (step.step_type === 'conditional_branch') {
        try {
          const res = executeConditional(step, ctx);
          resultObj = { result: res, attempts: 1 };
        } catch (e: any) {
          resultObj = { error: e.message || 'Conditional eval failed', attempts: 1 };
        }
      } else if (step.step_type === 'db_write') {
        try {
          const res = await executeDbWrite(step, ctx);
          resultObj = { result: res, attempts: 1 };
        } catch (e: any) {
          resultObj = { error: e.message || 'DB write failed', attempts: 1 };
        }
      } else if (step.step_type === 'notify') {
        try {
          const res = await executeNotify(step, ctx);
          resultObj = { result: res, attempts: 1 };
        } catch (e: any) {
          resultObj = { error: e.message || 'Notify failed to queue', attempts: 1 };
        }
      } else {
        resultObj = { error: `Unsupported step type: ${step.step_type}`, attempts: 1 };
      }

      if (resultObj.error) {
        await updateStepRun(stepRunId, 'failed', null, resultObj.error, resultObj.attempts);
        await failWorkflowRun(workflowRunId, `Step ${step.name} failed: ${resultObj.error}`);
        return; // Abort workflow
      } else {
        let output = resultObj.result;
        
        if (step.step_type === 'conditional_branch') {
          output = resultObj.result.output;
          ctx.pendingJoin = resultObj.result.joinStepId;
          jumpTargetId = resultObj.result.nextStepId;
        } else {
          if (ctx.pendingJoin) {
            jumpTargetId = ctx.pendingJoin;
            ctx.pendingJoin = undefined;
          } else {
            currentIndex++; 
          }
        }

        await updateStepRun(stepRunId, 'completed', output, null, resultObj.attempts);
        ctx.previousOutput = output;
        ctx.steps[step.id] = { input, output, status: 'completed' };
      }
    }

    // All steps executed successfully
    await completeWorkflowRun(workflowRunId, orgId);

  } catch (err: any) {
    console.error('[runWorkflow] Uncaught error:', err);
    await failWorkflowRun(workflowRunId, err.message || 'Internal runner error');
  }
}
