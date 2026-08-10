export type StepType = 'llm_call' | 'http_request' | 'db_write' | 'notify' | 'conditional_branch' | 'approval_gate';

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_type: StepType;
  name: string;
  config: Record<string, any>;
  step_order: number;
}

export type StepRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_for_approval';

export interface StepRun {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  status: StepRunStatus;
  step_order: number;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  error: string | null;
  attempt_count: number;
}

export interface ExecutionContext {
  workflowRunId: string;
  workflowId: string;
  previousOutput: any;
  steps: Record<string, { input: any; output: any; status: string }>;
  pendingJoin?: string;
}

export interface ExecutionResult {
  output: any;
  nextStepId?: string;
  joinStepId?: string; // used for branching to skip other branch
}
