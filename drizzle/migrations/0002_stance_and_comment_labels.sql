ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS stance_target text NULL;

CREATE TABLE public.comment_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  sentiment text,
  stance text NULL,
  account_type text,
  language text,
  gender text,
  age text,
  country text,
  human_sentiment text NULL,
  human_stance text NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, comment_id)
);
GRANT ALL ON public.comment_labels TO service_role;
ALTER TABLE public.comment_labels ENABLE ROW LEVEL SECURITY;
CREATE INDEX comment_labels_analysis_id_idx ON public.comment_labels(analysis_id);