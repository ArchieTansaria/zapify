import { ExecutionContext, WorkflowStep } from '../types';

export function executeConditional(step: WorkflowStep, ctx: ExecutionContext): { nextStepId?: string, joinStepId?: string, output: any } {
  const { source, operator, value, if_true, if_false, after } = step.config;

  let targetValue = null;
  if (source === 'previous_output') {
    targetValue = ctx.previousOutput;
  }
  
  let result = false;
  const strTarget = String(targetValue);
  const strValue = String(value);

  switch (operator) {
    case 'equals':
      result = strTarget === strValue;
      break;
    case 'not_equals':
      result = strTarget !== strValue;
      break;
    case 'contains':
      result = strTarget.includes(strValue);
      break;
    default:
      result = false;
  }

  const nextStepId = result ? if_true : if_false;

  return {
    output: { evaluated: result },
    nextStepId,
    joinStepId: after
  };
}
