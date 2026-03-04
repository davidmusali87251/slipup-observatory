-- Adds geographic bucket support for local climate scope.
-- Safe to run multiple times.

alter table public.moments
  add column if not exists geo_bucket text null;

create index if not exists moments_shared_hidden_geo_timestamp_desc
  on public.moments (shared, hidden, geo_bucket, timestamp desc);
