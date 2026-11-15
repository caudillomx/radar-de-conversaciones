CREATE TABLE public.studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'deep' CHECK (kind IN ('quick','deep')),
  title text NOT NULL,
  topic text NOT NULL DEFAULT '',
  client text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.studies TO service_role;
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  url text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram','tiktok','youtube','facebook','x')),
  post_id text,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','lista','iniciando','extrayendo','extraida','error')),
  max_comments int NOT NULL DEFAULT 500,
  include_replies boolean NOT NULL DEFAULT true,
  apify_run_id text,
  apify_dataset_id text,
  error text,
  comment_count int NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (study_id, url)
);
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE INDEX sources_study_idx ON public.sources(study_id);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  external_id text,
  author text,
  text text NOT NULL,
  published_at timestamptz,
  likes int NOT NULL DEFAULT 0,
  url text,
  is_reply boolean NOT NULL DEFAULT false,
  parent_external_id text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX comments_source_idx ON public.comments(source_id);
CREATE UNIQUE INDEX comments_source_ext_uniq ON public.comments(source_id, external_id);