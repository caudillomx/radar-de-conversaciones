CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'procesando' CHECK (status IN ('procesando','completado','error')),
  model text,
  comment_count int NOT NULL DEFAULT 0,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT ALL ON public.analyses TO service_role;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE INDEX analyses_study_idx ON public.analyses(study_id, created_at DESC);