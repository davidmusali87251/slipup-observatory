-- Phase 4: marker and combination storage for observatory signals.
-- Safe to run multiple times.

create table if not exists public.marker_5m_bucket (
  bucket_start timestamptz not null,
  geo_bucket text null,
  marker_key text not null,
  marker_value numeric not null default 0,
  sample_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint marker_5m_bucket_pk primary key (bucket_start, geo_bucket, marker_key)
);

create index if not exists marker_5m_bucket_geo_start_idx
  on public.marker_5m_bucket (geo_bucket, bucket_start desc);

create index if not exists marker_5m_bucket_key_start_idx
  on public.marker_5m_bucket (marker_key, bucket_start desc);

create table if not exists public.combo_5m_bucket (
  bucket_start timestamptz not null,
  geo_bucket text null,
  type text not null,
  mood text not null,
  shared_count integer not null default 0,
  reflective_sum numeric not null default 0,
  reactive_sum numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint combo_5m_bucket_pk primary key (bucket_start, geo_bucket, type, mood)
);

create index if not exists combo_5m_bucket_geo_start_idx
  on public.combo_5m_bucket (geo_bucket, bucket_start desc);

create index if not exists combo_5m_bucket_type_mood_start_idx
  on public.combo_5m_bucket (type, mood, bucket_start desc);

create table if not exists public.marker_catalog (
  marker_key text primary key,
  label text not null,
  description text not null,
  created_at timestamptz not null default now()
);

insert into public.marker_catalog (marker_key, label, description)
values
  ('mass', 'Signal Mass', 'Total shared contribution mass in this 5-minute bucket'),
  ('pressure', 'Signal Pressure', 'Reactive minus reflective pressure balance'),
  ('reflective_ratio', 'Reflective Ratio', 'Reflective share of note signal in this bucket')
on conflict (marker_key) do nothing;

create or replace function public.consume_marker_combo_bucket(
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
declare
  v_reflective numeric := coalesce(p_reflective, 0);
  v_reactive numeric := coalesce(p_reactive, 0);
  v_pressure numeric := v_reactive - v_reflective;
  v_total_signal numeric := greatest(v_reflective + v_reactive, 0);
  v_reflective_ratio numeric := case when v_total_signal > 0 then v_reflective / v_total_signal else 0 end;
begin
  insert into public.combo_5m_bucket (
    bucket_start,
    geo_bucket,
    type,
    mood,
    shared_count,
    reflective_sum,
    reactive_sum
  )
  values (
    p_bucket_start,
    p_geo_bucket,
    p_type,
    p_mood,
    1,
    v_reflective,
    v_reactive
  )
  on conflict (bucket_start, geo_bucket, type, mood)
  do update set
    shared_count = combo_5m_bucket.shared_count + 1,
    reflective_sum = combo_5m_bucket.reflective_sum + v_reflective,
    reactive_sum = combo_5m_bucket.reactive_sum + v_reactive,
    updated_at = now();

  insert into public.marker_5m_bucket (bucket_start, geo_bucket, marker_key, marker_value, sample_count)
  values
    (p_bucket_start, p_geo_bucket, 'mass', 1, 1),
    (p_bucket_start, p_geo_bucket, 'pressure', v_pressure, 1),
    (p_bucket_start, p_geo_bucket, 'reflective_ratio', v_reflective_ratio, 1)
  on conflict (bucket_start, geo_bucket, marker_key)
  do update set
    marker_value = marker_5m_bucket.marker_value + excluded.marker_value,
    sample_count = marker_5m_bucket.sample_count + excluded.sample_count,
    updated_at = now();
end;
$$;
