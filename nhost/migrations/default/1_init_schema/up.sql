-- Automara: Core Schema
-- Tables: organizations, org_members, workflows, workflow_steps,
--          workflow_triggers, workflow_runs, step_runs

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE org_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TYPE step_type AS ENUM (
  'llm_call',
  'http_request',
  'db_write',
  'notify',
  'conditional_branch',
  'approval_gate'
);

CREATE TYPE trigger_type AS ENUM (
  'manual',
  'webhook',
  'scheduled',
  'database_event'
);

CREATE TYPE run_status AS ENUM (
  'pending',
  'running',
  'paused',
  'completed',
  'failed'
);

CREATE TYPE step_run_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'waiting_for_approval'
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

CREATE TABLE public.organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  quota_limit integer NOT NULL DEFAULT 1000,
  quota_used  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ORG MEMBERS  (links auth.users → organizations)
-- ============================================================

CREATE TABLE public.org_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       org_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.org_members(user_id);
CREATE INDEX idx_org_members_org  ON public.org_members(org_id);

-- ============================================================
-- WORKFLOWS
-- ============================================================

CREATE TABLE public.workflows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_org ON public.workflows(org_id);

-- ============================================================
-- WORKFLOW STEPS  (ordered nodes inside a workflow)
-- ============================================================

CREATE TABLE public.workflow_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  step_type     step_type NOT NULL,
  name          text NOT NULL,
  config        jsonb NOT NULL DEFAULT '{}',
  step_order    integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, step_order)
);

CREATE INDEX idx_workflow_steps_workflow ON public.workflow_steps(workflow_id);

-- ============================================================
-- WORKFLOW TRIGGERS
-- ============================================================

CREATE TABLE public.workflow_triggers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_type  trigger_type NOT NULL,
  config        jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_triggers_workflow ON public.workflow_triggers(workflow_id);

-- ============================================================
-- WORKFLOW RUNS  (one per execution)
-- ============================================================

CREATE TABLE public.workflow_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  status        run_status NOT NULL DEFAULT 'pending',
  triggered_by  uuid REFERENCES auth.users(id),
  trigger_type  trigger_type NOT NULL DEFAULT 'manual',
  started_at    timestamptz,
  completed_at  timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_runs_workflow ON public.workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status   ON public.workflow_runs(status);

-- ============================================================
-- STEP RUNS  (one per step per run)
-- ============================================================

CREATE TABLE public.step_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  workflow_step_id uuid NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  status          step_run_status NOT NULL DEFAULT 'pending',
  step_order      integer NOT NULL,
  input           jsonb,
  output          jsonb,
  error           text,
  attempt_count   integer NOT NULL DEFAULT 0,
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_step_runs_workflow_run ON public.step_runs(workflow_run_id);
CREATE INDEX idx_step_runs_status       ON public.step_runs(status);

-- ============================================================
-- AGGREGATION VIEW: org usage this month
-- (SPEC: "One aggregation — org-level usage this month")
-- ============================================================

CREATE VIEW public.org_usage_stats AS
SELECT
  o.id           AS org_id,
  o.name         AS org_name,
  o.quota_limit,
  o.quota_used,
  o.quota_limit - o.quota_used AS quota_remaining,
  (SELECT count(*)
   FROM public.workflow_runs wr
   JOIN public.workflows w ON w.id = wr.workflow_id
   WHERE w.org_id = o.id
     AND wr.created_at >= date_trunc('month', now())
  ) AS runs_this_month
FROM public.organizations o;

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflow_steps_updated_at
  BEFORE UPDATE ON public.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflow_triggers_updated_at
  BEFORE UPDATE ON public.workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflow_runs_updated_at
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_step_runs_updated_at
  BEFORE UPDATE ON public.step_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
