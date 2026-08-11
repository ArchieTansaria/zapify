-- Seed file for Milestone 2 testing

-- Insert users into auth.users (simplistic insert for testing purposes)
-- Note: In a real Nhost app, users are managed by the auth service. 
-- For our backend tests, we just need their IDs to exist so foreign keys work.
INSERT INTO auth.users (id, email, password_hash, default_role, locale, email_verified)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com', '$2b$10$SbWhhRaIJKYy3upCLIu1g.RB2k3RJskmguNRLW6RalvbCBJk1f0ay', 'user', 'en', true),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.com', '$2b$10$SbWhhRaIJKYy3upCLIu1g.RB2k3RJskmguNRLW6RalvbCBJk1f0ay', 'user', 'en', true),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.com', '$2b$10$SbWhhRaIJKYy3upCLIu1g.RB2k3RJskmguNRLW6RalvbCBJk1f0ay', 'user', 'en', true),
  ('44444444-4444-4444-4444-444444444444', 'dave@test.com', '$2b$10$SbWhhRaIJKYy3upCLIu1g.RB2k3RJskmguNRLW6RalvbCBJk1f0ay', 'user', 'en', true)
ON CONFLICT (id) DO NOTHING;

-- Insert organizations
INSERT INTO public.organizations (id, name, quota_limit)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A', 1000),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B', 1000)
ON CONFLICT (id) DO NOTHING;

-- Insert org members
INSERT INTO public.org_members (org_id, user_id, role)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'viewer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'owner')
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Insert some data in Org A
INSERT INTO public.workflows (id, org_id, name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A Workflow 1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workflow_steps (id, workflow_id, step_type, name, step_order)
VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'llm_call', 'Step 1', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workflow_runs (id, workflow_id, status)
VALUES
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'completed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.step_runs (id, workflow_run_id, workflow_step_id, status, step_order)
VALUES
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'completed', 1)
ON CONFLICT (id) DO NOTHING;
