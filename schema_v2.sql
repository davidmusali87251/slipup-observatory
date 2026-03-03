-- SlipUp Observatory V2 clean schema
-- New tables only, no V1 reuse.

create table if not exists public.moments_v2 (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_day date not null,
  type text not null check (type in ('avoidable', 'fertile', 'observed')),
  mood text not null,
  note varchar(19),
  shared boolean not null default true,
  hidden boolean not null default false
);

create index if not exists moments_v2_created_at_idx on public.moments_v2 (created_at desc);
create index if not exists moments_v2_client_day_idx on public.moments_v2 (client_day);
create index if not exists moments_v2_type_idx on public.moments_v2 (type);

create table if not exists public.aggregates_v2 (
  bucket_start timestamptz primary key,
  bucket_label text not null,
  total_count integer not null,
  avoidable_count integer not null,
  fertile_count integer not null,
  observed_count integer not null,
  mood_distribution jsonb not null default '{}'::jsonb,
  degree_target numeric(5,2) not null,
  degree_smoothed numeric(5,2) not null,
  computed_at timestamptz not null default now()
);

create index if not exists aggregates_v2_computed_at_idx on public.aggregates_v2 (computed_at desc);
