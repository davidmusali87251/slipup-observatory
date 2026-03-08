-- Hourly climate aggregation: scale path for 48h window = 48 rows instead of 576 (5m).
-- Safe to run multiple times. Does not touch schema_v2.sql.

-- Same shape as climate_5m_bucket; bucket_start is truncated to hour (UTC).
-- Future: climate service can read from this table when CLIMATE_USE_HOURLY=true.
-- Job contract: run periodically (e.g. every hour) to aggregate from climate_5m_bucket
-- into climate_buckets_hourly for (date_trunc('hour', bucket_start), geo_bucket).
create table if not exists public.climate_buckets_hourly (
  bucket_start timestamptz not null,
  geo_bucket text null,
  shared_count integer not null default 0,
  reflective_sum numeric not null default 0,
  reactive_sum numeric not null default 0,
  avoidable_calm integer not null default 0,
  avoidable_focus integer not null default 0,
  avoidable_stressed integer not null default 0,
  avoidable_curious integer not null default 0,
  avoidable_tired integer not null default 0,
  fertile_calm integer not null default 0,
  fertile_focus integer not null default 0,
  fertile_stressed integer not null default 0,
  fertile_curious integer not null default 0,
  fertile_tired integer not null default 0,
  observed_calm integer not null default 0,
  observed_focus integer not null default 0,
  observed_stressed integer not null default 0,
  observed_curious integer not null default 0,
  observed_tired integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint climate_buckets_hourly_pk primary key (bucket_start, geo_bucket)
);

create index if not exists climate_buckets_hourly_geo_start_idx
  on public.climate_buckets_hourly (geo_bucket, bucket_start desc);

create index if not exists climate_buckets_hourly_start_idx
  on public.climate_buckets_hourly (bucket_start desc);

comment on table public.climate_buckets_hourly is
  'Hourly aggregates for climate. Filled by job from climate_5m_bucket (or raw moments). For 48h window, climate service reads 48 rows. Same computeClimate input contract as 5m buckets.';
