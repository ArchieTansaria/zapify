-- Pass 1
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
DROP TABLE IF EXISTS public.notifications;
DROP TYPE IF EXISTS notification_status;

DROP TRIGGER IF EXISTS trg_workflow_custom_data_updated_at ON public.workflow_custom_data;
DROP TABLE IF EXISTS public.workflow_custom_data;
