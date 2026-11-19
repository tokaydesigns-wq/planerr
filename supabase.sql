-- Planerr community feed. Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- Anyone with the app can read shared adventures and post new ones; nobody can edit or delete
-- other people's posts through the app (you can moderate from the Supabase dashboard).

create table if not exists public.adventures (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  author      text check (char_length(author) <= 40),
  title       text not null check (char_length(title) between 1 and 80),
  type        text check (char_length(type) <= 20),
  region      text check (char_length(region) <= 120),
  trip_date   date,
  rating      int check (rating between 1 and 5),
  review      text check (char_length(review) <= 2000),
  tips        text check (char_length(tips) <= 1000),
  budget      numeric check (budget >= 0 and budget < 100000),
  family_ages int[] default '{}',
  photo       text check (photo is null or photo like 'https://upload.wikimedia.org/%' or photo like 'https://commons.wikimedia.org/%'),
  stops       jsonb not null default '[]' check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 30),
  main_index  int default 0
);

alter table public.adventures enable row level security;

drop policy if exists "Anyone can read shared adventures" on public.adventures;
create policy "Anyone can read shared adventures" on public.adventures
  for select using (true);

drop policy if exists "Anyone can share an adventure" on public.adventures;
create policy "Anyone can share an adventure" on public.adventures
  for insert with check (true);

create index if not exists adventures_created_at_idx on public.adventures (created_at desc);

-- ---------- Reports (added Nov 2026; safe to run again) ----------
-- Anyone can report a post. Once 3 different phones report it, it's hidden from Explore.
-- Reports can't be read through the app; you can see them in Table Editor → adventure_reports,
-- and bring a post back by unticking "hidden" on it in Table Editor → adventures.
alter table public.adventures add column if not exists hidden boolean not null default false;

drop policy if exists "Anyone can read shared adventures" on public.adventures;
create policy "Anyone can read shared adventures" on public.adventures
  for select using (not hidden);

create table if not exists public.adventure_reports (
  adventure_id uuid not null references public.adventures (id) on delete cascade,
  reporter     text not null check (char_length(reporter) between 8 and 40),
  created_at   timestamptz not null default now(),
  primary key (adventure_id, reporter)
);

alter table public.adventure_reports enable row level security;

drop policy if exists "Anyone can report a post" on public.adventure_reports;
create policy "Anyone can report a post" on public.adventure_reports
  for insert with check (true);

create or replace function public.hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from adventure_reports where adventure_id = new.adventure_id) >= 3 then
    update adventures set hidden = true where id = new.adventure_id;
  end if;
  return new;
end $$;

drop trigger if exists hide_reported on public.adventure_reports;
create trigger hide_reported after insert on public.adventure_reports
  for each row execute function public.hide_reported();

-- ---------- Owner tools: reviewing reported posts (added Nov 2026) ----------
-- These are for YOU, in the Supabase dashboard (SQL Editor). They are NOT part of the app and
-- are all inside /* ... */ comments, so running this whole file again does nothing to them.
-- To use one: copy it (without the /* and */ lines) into a NEW query tab, and click Run.
-- The README ("Reviewing reported posts") has the same queries with step-by-step clicks.

/* 1. LIST hidden posts (newest first). Safe: only reads.
select a.id, a.title, a.region as place, a.created_at as posted_on, count(r.reporter) as reports
from public.adventures a
left join public.adventure_reports r on r.adventure_id = a.id
where a.hidden
group by a.id
order by a.created_at desc;
*/

/* 2. RESTORE a post: show it in Explore again. Replace PASTE-POST-ID-HERE with an id from query 1.
   Its reports are cleared too, so it doesn't instantly hide itself again.
begin;
delete from public.adventure_reports where adventure_id = 'PASTE-POST-ID-HERE';
update public.adventures set hidden = false where id = 'PASTE-POST-ID-HERE';
commit;
*/

/* 3. DELETE a post FOREVER (and its reports). This can't be undone.
   Replace PASTE-POST-ID-HERE with an id from query 1.
delete from public.adventures where id = 'PASTE-POST-ID-HERE';
*/
