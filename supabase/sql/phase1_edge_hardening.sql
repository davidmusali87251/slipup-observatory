-- SlipUp Observatory V2 - Phase 1 Edge hardening
-- Apply in Supabase SQL editor.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('avoidable', 'fertile', 'observed')),
  mood text not null check (mood in ('calm', 'focus', 'stressed', 'curious', 'tired')),
  note varchar(19) not null default '',
  shared boolean not null default true,
  hidden boolean not null default false,
  client_day date null
);

create index if not exists moments_shared_timestamp_desc
  on public.moments (shared, timestamp desc);

create index if not exists moments_shared_hidden_timestamp_desc
  on public.moments (shared, hidden, timestamp desc);

create table if not exists public.rate_limits (
  key_hash text primary key,
  window_start timestamptz not null,
  hits int not null
);

create or replace function public.consume_rate_limit(
  p_key text,
  p_window_seconds int,
  p_max int
)
returns table(allowed boolean, remaining int, reset_at timestamptz)
language plpgsql
as $$
declare
  now_ts timestamptz := now();
  win_start timestamptz := to_timestamp(
    floor(extract(epoch from now_ts) / p_window_seconds) * p_window_seconds
  );
  new_hits int;
begin
  insert into public.rate_limits (key_hash, window_start, hits)
  values (p_key, win_start, 1)
  on conflict (key_hash) do update
    set window_start = excluded.window_start,
        hits = case
          when rate_limits.window_start = excluded.window_start then rate_limits.hits + 1
          else 1
        end
  returning hits into new_hits;

  allowed := new_hits <= p_max;
  remaining := greatest(p_max - new_hits, 0);
  reset_at := win_start + make_interval(secs => p_window_seconds);
  return next;
end;
$$;

-- Keep direct table access closed; browser should hit Edge Function only.
revoke all on table public.moments from anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;

alter table public.moments enable row level security;
alter table public.rate_limits enable row level security;

-- Keep RLS guardrails as defense-in-depth.
drop policy if exists "public_read_shared" on public.moments;
create policy "public_read_shared"
on public.moments
for select
to anon
using (shared = true and hidden = false);

drop policy if exists "public_insert_moments" on public.moments;
create policy "public_insert_moments"
on public.moments
for insert
to anon
with check (
  hidden = false
  and note is not null
  and length(note) <= 19
  and type in ('avoidable', 'fertile', 'observed')
  and mood in ('calm', 'focus', 'stressed', 'curious', 'tired')
);

-- GC for hashed rate-limit keys: short retention lowers privacy risk.
select cron.schedule(
  'rate_limits_gc_hourly',
  '0 * * * *',
  $$delete from public.rate_limits
    where window_start < now() - interval '72 hours';$$
)
where not exists (
  select 1 from cron.job where jobname = 'rate_limits_gc_hourly'
);
