-- Phase 3: scalable 5-minute climate buckets.
-- Safe to run multiple times.

create table if not exists public.climate_5m_bucket (
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
  constraint climate_5m_bucket_pk primary key (bucket_start, geo_bucket)
);

create index if not exists climate_5m_bucket_geo_start_idx
  on public.climate_5m_bucket (geo_bucket, bucket_start desc);

create index if not exists climate_5m_bucket_start_idx
  on public.climate_5m_bucket (bucket_start desc);

create or replace function public.consume_climate_bucket(
  p_bucket_start timestamptz,
  p_geo_bucket text,
  p_type text,
  p_mood text,
  p_reflective numeric,
  p_reactive numeric
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.climate_5m_bucket (
    bucket_start,
    geo_bucket,
    shared_count,
    reflective_sum,
    reactive_sum,
    avoidable_calm,
    avoidable_focus,
    avoidable_stressed,
    avoidable_curious,
    avoidable_tired,
    fertile_calm,
    fertile_focus,
    fertile_stressed,
    fertile_curious,
    fertile_tired,
    observed_calm,
    observed_focus,
    observed_stressed,
    observed_curious,
    observed_tired
  )
  values (
    p_bucket_start,
    p_geo_bucket,
    1,
    coalesce(p_reflective, 0),
    coalesce(p_reactive, 0),
    case when p_type = 'avoidable' and p_mood = 'calm' then 1 else 0 end,
    case when p_type = 'avoidable' and p_mood = 'focus' then 1 else 0 end,
    case when p_type = 'avoidable' and p_mood = 'stressed' then 1 else 0 end,
    case when p_type = 'avoidable' and p_mood = 'curious' then 1 else 0 end,
    case when p_type = 'avoidable' and p_mood = 'tired' then 1 else 0 end,
    case when p_type = 'fertile' and p_mood = 'calm' then 1 else 0 end,
    case when p_type = 'fertile' and p_mood = 'focus' then 1 else 0 end,
    case when p_type = 'fertile' and p_mood = 'stressed' then 1 else 0 end,
    case when p_type = 'fertile' and p_mood = 'curious' then 1 else 0 end,
    case when p_type = 'fertile' and p_mood = 'tired' then 1 else 0 end,
    case when p_type = 'observed' and p_mood = 'calm' then 1 else 0 end,
    case when p_type = 'observed' and p_mood = 'focus' then 1 else 0 end,
    case when p_type = 'observed' and p_mood = 'stressed' then 1 else 0 end,
    case when p_type = 'observed' and p_mood = 'curious' then 1 else 0 end,
    case when p_type = 'observed' and p_mood = 'tired' then 1 else 0 end
  )
  on conflict (bucket_start, geo_bucket)
  do update set
    shared_count = climate_5m_bucket.shared_count + 1,
    reflective_sum = climate_5m_bucket.reflective_sum + coalesce(p_reflective, 0),
    reactive_sum = climate_5m_bucket.reactive_sum + coalesce(p_reactive, 0),
    avoidable_calm = climate_5m_bucket.avoidable_calm + case when p_type = 'avoidable' and p_mood = 'calm' then 1 else 0 end,
    avoidable_focus = climate_5m_bucket.avoidable_focus + case when p_type = 'avoidable' and p_mood = 'focus' then 1 else 0 end,
    avoidable_stressed = climate_5m_bucket.avoidable_stressed + case when p_type = 'avoidable' and p_mood = 'stressed' then 1 else 0 end,
    avoidable_curious = climate_5m_bucket.avoidable_curious + case when p_type = 'avoidable' and p_mood = 'curious' then 1 else 0 end,
    avoidable_tired = climate_5m_bucket.avoidable_tired + case when p_type = 'avoidable' and p_mood = 'tired' then 1 else 0 end,
    fertile_calm = climate_5m_bucket.fertile_calm + case when p_type = 'fertile' and p_mood = 'calm' then 1 else 0 end,
    fertile_focus = climate_5m_bucket.fertile_focus + case when p_type = 'fertile' and p_mood = 'focus' then 1 else 0 end,
    fertile_stressed = climate_5m_bucket.fertile_stressed + case when p_type = 'fertile' and p_mood = 'stressed' then 1 else 0 end,
    fertile_curious = climate_5m_bucket.fertile_curious + case when p_type = 'fertile' and p_mood = 'curious' then 1 else 0 end,
    fertile_tired = climate_5m_bucket.fertile_tired + case when p_type = 'fertile' and p_mood = 'tired' then 1 else 0 end,
    observed_calm = climate_5m_bucket.observed_calm + case when p_type = 'observed' and p_mood = 'calm' then 1 else 0 end,
    observed_focus = climate_5m_bucket.observed_focus + case when p_type = 'observed' and p_mood = 'focus' then 1 else 0 end,
    observed_stressed = climate_5m_bucket.observed_stressed + case when p_type = 'observed' and p_mood = 'stressed' then 1 else 0 end,
    observed_curious = climate_5m_bucket.observed_curious + case when p_type = 'observed' and p_mood = 'curious' then 1 else 0 end,
    observed_tired = climate_5m_bucket.observed_tired + case when p_type = 'observed' and p_mood = 'tired' then 1 else 0 end,
    updated_at = now();
end;
$$;
