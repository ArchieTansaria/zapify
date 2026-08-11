-- Pass 1: db_write custom data table
CREATE TABLE public.workflow_custom_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  step_run_id uuid REFERENCES public.step_runs(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_custom_data_org ON public.workflow_custom_data(org_id);

CREATE TRIGGER trg_workflow_custom_data_updated_at
  BEFORE UPDATE ON public.workflow_custom_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Pass 1: notify notifications table
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  target text NOT NULL,
  message text NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_org ON public.notifications(org_id);

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
