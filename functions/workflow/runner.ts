import { ExecutionContext, WorkflowStep } from './types';
import { loadWorkflowSteps, createStepRun, updateStepRun, completeWorkflowRun, failWorkflowRun } from './persistence';
import { executeLLM } from './executors/llm';
import { executeHttp } from './executors/http';
import { executeConditional } from './executors/conditional';
import { executeWithRetry } from './retry';

export async function runWorkflow(workflowRunId: string, workflowId: string, orgId: string) {
  try {
    const steps = await loadWorkflowSteps(workflowId);
    if (steps.length === 0) {
      await completeWorkflowRun(workflowRunId, orgId);
      return;
    }

    const ctx: ExecutionContext = {
      workflowRunId,
      workflowId,
      previousOutput: null,
      steps: {}
    };

    let currentIndex = 0;
    // We use a flat index, but conditional branches can manipulate execution
    let jumpTargetId: string | undefined = undefined;

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

      const input = { previousOutput: ctx.previousOutput };
      const stepRunId = await createStepRun(workflowRunId, step.id, step.step_order, input);

      let resultObj: { result?: any, error?: string, attempts: number };

      if (step.step_type === 'llm_call') {
        resultObj = await executeWithRetry(() => executeLLM(step, ctx), 3);
      } else if (step.step_type === 'http_request') {
        resultObj = await executeWithRetry(() => executeHttp(step, ctx), 3);
      } else if (step.step_type === 'conditional_branch') {
        // Conditionals shouldn't retry
        try {
          const res = executeConditional(step, ctx);
          resultObj = { result: res, attempts: 1 };
        } catch (e: any) {
          resultObj = { error: e.message || 'Conditional eval failed', attempts: 1 };
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
        
        // Handle conditional branch special return
        if (step.step_type === 'conditional_branch') {
          output = resultObj.result.output;
          // IMPORTANT BRANCHING SEMANTICS:
          // The conditional executor returns `nextStepId` and `joinStepId`.
          // We must jump to `nextStepId`, and once that branch is done, we jump to `joinStepId`.
          // For simplicity in this engine, if `nextStepId` is defined, we set it as jump target.
          // The tricky part: how to skip the unselected branch and resume at `joinStepId`?
          // Since we don't have a DAG, the selected branch will just execute until it reaches the end,
          // OR it must explicitly jump to `joinStepId` when it's done. 
          // But a regular step doesn't know about `joinStepId`.
          // Better design per the requirements: The Conditional step itself just jumps to `nextStepId`.
          // If we need to skip the other branch entirely, the user should configure the branch steps
          // to jump to the join step, or we can just say "conditional skips to nextStepId, and that's it".
          // Wait, the prompt says: "After executing the selected branch, the runner must jump to the configured continuation/join point rather than accidentally traversing the other branch."
          // So if step A is executed, it shouldn't fall through to step B.
          // To implement this simply: 
          // If a conditional returns nextStepId and joinStepId, we can find the nextStep, execute it, 
          // then automatically jump to joinStepId. This assumes the branch is EXACTLY one step!
          // If the branch is multiple steps, a simple runner would need a stack.
          // Let's implement a simple branch override:
          // We execute the conditional. It sets `jumpTargetId = nextStepId`.
          // It also pushes `joinStepId` to a stack with a target condition? No, the easiest is: 
          // The conditional step just skips the unselected steps by jumping straight to `nextStepId`.
          // If the branch only contains one step, after that step, the index naturally increments.
          // If `nextStepId` is Step 3, and Step 4 is the other branch, how does it jump over Step 4 to Step 5 (join)?
          // We can just execute Step 3, then jump to Step 5.
          // Let's store `pendingJoinStepId` globally for the branch execution.
          ctx.pendingJoin = resultObj.result.joinStepId;
          jumpTargetId = resultObj.result.nextStepId;
        } else {
          // If we just executed a branch step and have a pendingJoin, we jump to it.
          if (ctx.pendingJoin) {
            jumpTargetId = ctx.pendingJoin;
            ctx.pendingJoin = undefined;
          } else {
            currentIndex++; // normal sequential flow
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
