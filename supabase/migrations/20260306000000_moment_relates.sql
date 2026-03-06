-- Relate count per moment: one row per (moment_id, visitor_fp) so each visitor counts once.
-- Safe to run multiple times.

create table if not exists public.moment_relates (
  moment_id uuid not null references public.moments(id) on delete cascade,
  visitor_fp text not null,
  created_at timestamptz not null default now(),
  constraint moment_relates_pk primary key (moment_id, visitor_fp)
);

create index if not exists moment_relates_moment_id_idx
  on public.moment_relates (moment_id);

comment on table public.moment_relates is 'Count of "Not alone" / resonate clicks per moment; one per visitor (fingerprint).';
