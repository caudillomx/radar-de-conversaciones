ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'muestreo',
  ADD COLUMN IF NOT EXISTS batches_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batches_done integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sample jsonb,
  ADD COLUMN IF NOT EXISTS codebook jsonb,
  ADD COLUMN IF NOT EXISTS synthesis jsonb,
  ADD COLUMN IF NOT EXISTS batch_attempts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS progress_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;
UPDATE public.analyses SET stage = 'completado' WHERE status = 'completado';
ALTER TABLE public.comment_labels ADD COLUMN IF NOT EXISTS narrative text NULL;
CREATE INDEX IF NOT EXISTS analyses_processing_idx ON public.analyses(status) WHERE status = 'procesando';