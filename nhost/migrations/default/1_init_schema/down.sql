-- Reverse of init_schema

DROP TRIGGER IF EXISTS trg_step_runs_updated_at ON public.step_runs;
DROP TRIGGER IF EXISTS trg_workflow_runs_updated_at ON public.workflow_runs;
DROP TRIGGER IF EXISTS trg_workflow_triggers_updated_at ON public.workflow_triggers;
DROP TRIGGER IF EXISTS trg_workflow_steps_updated_at ON public.workflow_steps;
DROP TRIGGER IF EXISTS trg_workflows_updated_at ON public.workflows;
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;

DROP FUNCTION IF EXISTS public.set_updated_at();

DROP VIEW IF EXISTS public.org_usage_stats;

DROP TABLE IF EXISTS public.step_runs;
DROP TABLE IF EXISTS public.workflow_runs;
DROP TABLE IF EXISTS public.workflow_triggers;
DROP TABLE IF EXISTS public.workflow_steps;
DROP TABLE IF EXISTS public.workflows;
DROP TABLE IF EXISTS public.org_members;
DROP TABLE IF EXISTS public.organizations;

DROP TYPE IF EXISTS step_run_status;
DROP TYPE IF EXISTS run_status;
DROP TYPE IF EXISTS trigger_type;
DROP TYPE IF EXISTS step_type;
DROP TYPE IF EXISTS org_role;
