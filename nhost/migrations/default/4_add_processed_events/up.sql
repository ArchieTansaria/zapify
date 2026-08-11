CREATE TABLE public.processed_events (
  event_id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
